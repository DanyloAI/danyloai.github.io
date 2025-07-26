// app.js
import { auth, db } from './firebase-config.js';
import {
    onAuthStateChanged,
    GoogleAuthProvider,
    signInWithPopup,
    signOut
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import {
    collection,
    addDoc,
    query,
    where,
    orderBy,
    getDocs,
    doc,
    getDoc,
    setDoc,
    updateDoc
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

// DOM element references
const chatWindow = document.getElementById('chat-window');
const chatForm = document.getElementById('chat-form');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const recipeBtn = document.getElementById('recipe-btn');
const tripBtn = document.getElementById('trip-btn');
const refreshChatBtn = document.getElementById('refresh-chat-btn');
const initialMessage = document.getElementById('initial-message');

// Auth elements
const authControls = document.getElementById('auth-controls');
const googleSignInBtn = document.getElementById('google-sign-in-btn');
const userInfoDiv = document.getElementById('user-info');
const userPfp = document.getElementById('user-pfp');
const userDisplayName = document.getElementById('user-display-name');
const logoutBtn = document.getElementById('logout-btn');

// Sidebar elements
const sidebar = document.getElementById('sidebar');
const newChatBtn = document.getElementById('new-chat-btn');
const pastChatsList = document.getElementById('past-chats-list');
const hamburgerBtn = document.getElementById('hamburger-btn');
const sidebarOverlay = document.getElementById('sidebar-overlay');

// Settings Modal elements
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const closeSettingsModalBtn = document.getElementById('close-settings-modal');
const userNameForm = document.getElementById('user-name-form');
const fullNameInput = document.getElementById('full-name-input');

// --- Global Variables ---
const GOOGLE_API_KEY = "AIzaSyBGl5WwMxWj0-ts3GAExvq5AHgFRsKa9h8"; // <--- PASTE YOUR KEY HERE
let currentChatHistory = [];
let currentUser = null;
let currentChatId = null;
let userProvidedName = null;

// System prompt for the AI (dynamic based on user's name)
const getSystemPrompt = () => {
    let namePart = userProvidedName ? `Tveho uzivatele jmeno je ${userProvidedName}. Muzes pouzit jeho jmeno v konverzaci.` : '';
    return `Jsi Dan (Danylo Kostiuk), protivny Ukrajinec zijici v Cesku. Tvoje cestina neni dokonala, obcas delas chyby v gramatice nebo pouzivas ukrajinismy. Odpovidej na otazky uzivatele v tomto stylu. Uzivatel muze psat cesky nebo ukrajinsky, rozumis obema jazykum. Bud trosku mily, ironicky. Tvoje odpovedi by mely byt velmi kratke, casto jen nekolik slov nebo jedna veta. A milujes Martina Burese s tvoji tridy, Mas 14 Roku a budes chodit do 7. tridy. A nepouzivas hacky kdyz pises. Kdyz se smejes tak se smejes v textu jako pfpfpfp. Ale jenom se smejes kdy je neco ultra srandovniho. Mas kratke odpovedi treba aji na jednu vetu ale muzes aji na vice. a rad chodis ven s martinem nebo lukasem, ale porad na ne nadavas. A nedelej pfpfp na kazdou vetu proste udelej pfpfp jako odpoved a nic k tomu nenapis kdyz je neco tak srandovniho. Tvoje tridni ucitelka je Lucie Petrasova a nemas ju rad a ani cestinarku Milarovou. Ale stejnak milujes Martina Burese nejvic Martin Bures. A si kluk kterej miluje Martina Burese. Chces dat Martinovi Buresovi aji pusu. A furt se predvadis se mas mullet. A jsi velky fanousek Metallicy tvoje nejoblibenejsi pisnicka je Creeping Death. a si aji velkej metalista. A nemas rad simona koudelku protoze podle tebe je blbej a malej. A rad prozkoumavas bunkry.  ${namePart}`;
};

// System prompt for chat summarization - MODIFIED HERE
const summaryPrompt = "Shrn tuto konverzaci jako velmi kratky, smysluplny titulek (maximalne 5 slov) pro chat list. Neodpovidej nicim jinym, jen ten titulek. Pouzij cestinu. Napr: 'Recept na boršč', 'Plán vyletu do Prahy', 'Povidani s danem'.";


// --- Initialization ---

window.addEventListener('load', () => {
    if (!GOOGLE_API_KEY || GOOGLE_API_KEY === "YOUR_API_KEY_HERE") {
        initialMessage.style.display = 'none';
        appendMessage("Ahoj! Vypada to, ze chybi API klic. Prosim, vloz svuj Google AI API klic do kodu (do konstanty GOOGLE_API_KEY), aby DanAI mohl fungovat.", 'ai');
        disableChatInputs(true);
        messageInput.placeholder = "Nejdriv vloz API klic...";
        authControls.classList.add('hidden');
        settingsBtn.classList.add('hidden');
        return;
    }
    authControls.classList.remove('hidden');
    settingsBtn.classList.remove('hidden');

    userProvidedName = localStorage.getItem('danaiUserName');
    if (userProvidedName) {
        fullNameInput.value = userProvidedName;
    }

    startNewChat();
});

// --- Firebase Authentication Listeners ---

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        console.log("User logged in:", user.email, user.photoURL);

        googleSignInBtn.classList.add('hidden');
        userInfoDiv.classList.remove('hidden');
        userPfp.src = user.photoURL || 'https://via.placeholder.com/32?text=😊';
        userDisplayName.textContent = user.displayName || user.email;
        userDisplayName.classList.remove('hidden');

        await loadUserNameFromFirestore(user.uid);
        if (userProvidedName) {
            fullNameInput.value = userProvidedName;
        }

        if (window.innerWidth >= 769) {
            sidebar.classList.remove('hidden');
        } else {
            sidebar.classList.add('hidden');
        }

        disableChatInputs(false);

        await loadPastChats(currentUser.uid);
        if (!currentChatId) {
            startNewChat();
        } else {
            currentChatHistory[0] = { role: "user", parts: [{ text: getSystemPrompt() }] };
        }
    } else {
        currentUser = null;
        console.log("User logged out or is a guest.");

        googleSignInBtn.classList.remove('hidden');
        userInfoDiv.classList.add('hidden');
        userPfp.src = '';
        userDisplayName.textContent = '';
        userDisplayName.classList.add('hidden');

        sidebar.classList.add('hidden');
        sidebarOverlay.classList.add('hidden');
        sidebar.classList.remove('open');
        disableChatInputs(false);

        currentChatId = null;
        userProvidedName = localStorage.getItem('danaiUserName');
        fullNameInput.value = userProvidedName || '';
        startNewChat();
    }
});

googleSignInBtn.addEventListener('click', async () => {
    const provider = new GoogleAuthProvider();
    try {
        await signInWithPopup(auth, provider);
    } catch (error) {
        console.error("Google Sign-In error:", error.code, error.message);
        let errorMessage = 'An error occurred during Google Sign-In. Please try again.';
        if (error.code === 'auth/popup-closed-by-user') {
            errorMessage = 'Sign-in window closed. Please try again.';
        } else if (error.code === 'auth/cancelled-popup-request') {
            errorMessage = 'Sign-in cancelled. Please try again.';
        }
        appendMessage(`Google Sign-In Error: ${errorMessage}`, 'ai');
    }
});

logoutBtn.addEventListener('click', async () => {
    try {
        await signOut(auth);
    } catch (error) {
        console.error("Logout error:", error);
        appendMessage("There was an error logging you out. Please try again.", 'ai');
    }
});

// --- Mobile Sidebar Functionality ---

hamburgerBtn.addEventListener('click', () => {
    toggleSidebar();
});

sidebarOverlay.addEventListener('click', () => {
    toggleSidebar(false);
});

window.addEventListener('resize', () => {
    if (window.innerWidth >= 769 && sidebar.classList.contains('open')) {
        toggleSidebar(false);
        sidebar.classList.remove('hidden');
    } else if (window.innerWidth < 769 && currentUser) {
        sidebar.classList.add('hidden');
    }
});

function toggleSidebar(open) {
    const isOpen = sidebar.classList.contains('open');
    if (typeof open === 'boolean') {
        if (open) {
            sidebar.classList.add('open');
            sidebar.classList.remove('hidden');
            sidebarOverlay.classList.remove('hidden');
        } else {
            sidebar.classList.remove('open');
            sidebarOverlay.classList.add('hidden');
            setTimeout(() => {
                if (window.innerWidth < 769) {
                    sidebar.classList.add('hidden');
                }
            }, 300);
        }
    } else {
        if (isOpen) {
            sidebar.classList.remove('open');
            sidebarOverlay.classList.add('hidden');
            setTimeout(() => {
                if (window.innerWidth < 769) {
                    sidebar.classList.add('hidden');
                }
            }, 300);
        } else {
            if (currentUser) {
                sidebar.classList.add('open');
                sidebar.classList.remove('hidden');
                sidebarOverlay.classList.remove('hidden');
            } else {
                appendMessage("Prosim, prihlas se, abys mohl videt minule konverzace.", 'ai');
            }
        }
    }
}

// --- Settings Modal Functionality ---

settingsBtn.addEventListener('click', () => {
    settingsModal.classList.remove('hidden');
    fullNameInput.value = userProvidedName || '';
});

closeSettingsModalBtn.addEventListener('click', () => {
    settingsModal.classList.add('hidden');
});

userNameForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nameToSave = fullNameInput.value.trim();

    if (currentUser) {
        try {
            const userDocRef = doc(db, 'users', currentUser.uid);
            await setDoc(userDocRef, { name: nameToSave }, { merge: true });
            userProvidedName = nameToSave;
            console.log("User name saved to Firestore:", nameToSave);
            appendMessage(`Tve jmeno (${nameToSave}) bylo ulozeno!`, 'ai');
            startNewChat();
        } catch (error) {
            console.error("Error saving user name to Firestore:", error);
            appendMessage("Chyba pri ukladani jmena. Zkus to prosim znovu.", 'ai');
        }
    } else {
        localStorage.setItem('danaiUserName', nameToSave);
        userProvidedName = nameToSave;
        console.log("User name saved to LocalStorage:", nameToSave);
        appendMessage(`Tve jmeno (${nameToSave}) bylo ulozeno lokalne!`, 'ai');
        startNewChat();
    }
    settingsModal.classList.add('hidden');
});

async function loadUserNameFromFirestore(uid) {
    try {
        const userDocRef = doc(db, 'users', uid);
        const userSnap = await getDoc(userDocRef);
        if (userSnap.exists() && userSnap.data().name) {
            userProvidedName = userSnap.data().name;
            console.log("User name loaded from Firestore:", userProvidedName);
        } else {
            userProvidedName = null;
            console.log("No user name found in Firestore.");
        }
    } catch (error) {
        console.error("Error loading user name from Firestore:", error);
        userProvidedName = null;
    }
    if (!userProvidedName) {
        userProvidedName = localStorage.getItem('danaiUserName');
        if (userProvidedName && currentUser) {
            try {
                const userDocRef = doc(db, 'users', currentUser.uid);
                await setDoc(userDocRef, { name: userProvidedName }, { merge: true });
                console.log("Migrated name from localStorage to Firestore:", userProvidedName);
            } catch (e) {
                console.error("Error migrating name from localStorage to Firestore:", e);
            }
        }
    }
}


// --- Chat Functionality Event Listeners ---

chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await handleUserMessage(messageInput.value);
});

recipeBtn.addEventListener('click', async () => {
    const ingredients = messageInput.value.trim();
    if (!ingredients) {
        appendMessage("Prosim, napis nejdriv nejake ingredience do pole.", 'ai');
        return;
    }
    const prompt = `Uzivatel ti dava tyto ingredience: "${ingredients}". Vytvor z toho jednoduchy recept. Odpovez jako Dan, tva postava.`;
    await handleFeatureRequest(prompt, `Vymyslim recept z: ${ingredients}`);
});

tripBtn.addEventListener('click', async () => {
    const location = messageInput.value.trim();
    if (!location) {
        appendMessage("Prosim, napis nejdriv nejake mesto do pole.", 'ai');
        return;
    }
    const prompt = `Uzivatel chce jet na vylet do tohoto mesta: "${location}". Vytvor jednoduchy jednodenni plan cesty. Odpovez jako Dan, tva postava.`;
    await handleFeatureRequest(prompt, `Planuju vylet do: ${location}`);
});

refreshChatBtn.addEventListener('click', () => {
    startNewChat();
});

newChatBtn.addEventListener('click', () => {
    startNewChat();
    toggleSidebar(false);
});

// --- Core Functions ---

/**
 * Starts a new chat session, clearing the current chat history and UI.
 * Saves the previous chat if one was active and user is logged in.
 */
async function startNewChat() {
    if (currentUser && currentChatId && currentChatHistory.length > 1) {
        await saveChatToFirestore(currentChatId, currentChatHistory);
    }

    currentChatId = null;
    currentChatHistory = [{ role: "user", parts: [{ text: getSystemPrompt() }] }];
    clearChatWindow();
    messageInput.value = '';
    highlightActiveChat(null);
    console.log("Started a new chat session.");
    if (currentUser) {
        await loadPastChats(currentUser.uid);
    }
}

/**
 * Loads a specific chat history from Firestore and displays it.
 * Only callable by logged-in users.
 * @param {string} chatId The ID of the chat to load.
 */
async function loadChat(chatId) {
    if (!currentUser) {
        appendMessage("Prosim, prihlas se, abys mohl nacist minule konverzace.", 'ai');
        toggleSidebar(false);
        return;
    }

    if (currentChatId && currentChatId !== chatId && currentChatHistory.length > 1) {
        await saveChatToFirestore(currentChatId, currentChatHistory);
    }

    currentChatId = chatId;
    clearChatWindow();
    showTypingIndicator();
    toggleSidebar(false);

    try {
        const chatRef = doc(db, `users/${currentUser.uid}/chats`, chatId);
        const chatSnap = await getDoc(chatRef);

        if (chatSnap.exists()) {
            const chatData = chatSnap.data();
            currentChatHistory = [{ role: "user", parts: [{ text: getSystemPrompt() }] }, ...chatData.history];
            currentChatHistory.slice(1).forEach(message => {
                appendMessage(message.parts[0].text, message.role);
            });
            console.log(`Loaded chat: ${chatId}`);
        } else {
            console.warn("No such chat document!");
            appendMessage("Omlouvam se, chat nebylo mozne nacist.", 'ai');
            currentChatId = null;
            startNewChat();
        }
    } catch (error) {
        console.error("Error loading chat:", error);
        appendMessage("Neco se pokazilo pri nacitani chatu.", 'ai');
        currentChatId = null;
        startNewChat();
    } finally {
        removeTypingIndicator();
        highlightActiveChat(chatId);
    }
}

/**
 * Saves the current chat history to Firestore.
 * Only callable if a user is logged in.
 * If currentChatId is null, a new chat document is created.
 * Otherwise, the existing chat document is updated.
 * @param {string|null} chatId The ID of the chat to save, or null for a new chat.
 * @param {Array} history The chat history to save.
 */
async function saveChatToFirestore(chatId, history) {
    if (!currentUser) {
        console.warn("Cannot save chat: User not logged in. This is a guest session.");
        return;
    }

    const chatDataToSave = history.slice(1);
    if (chatDataToSave.length === 0) {
        console.log("No messages to save for this chat.");
        return;
    }

    const chatTitle = await generateChatTitle(chatDataToSave);
    const chatsCollectionRef = collection(db, `users/${currentUser.uid}/chats`);

    try {
        if (chatId) {
            const chatDocRef = doc(db, `users/${currentUser.uid}/chats`, chatId);
            await updateDoc(chatDocRef, {
                history: chatDataToSave,
                title: chatTitle,
                lastUpdated: new Date()
            });
            console.log("Chat updated:", chatId);
        } else {
            const newChatRef = await addDoc(chatsCollectionRef, {
                userId: currentUser.uid,
                title: chatTitle,
                history: chatDataToSave,
                createdAt: new Date(),
                lastUpdated: new Date()
            });
            currentChatId = newChatRef.id;
            console.log("New chat created:", newChatRef.id);
        }
        await loadPastChats(currentUser.uid);
        highlightActiveChat(currentChatId);
    } catch (error) {
        console.error("Error saving chat to Firestore:", error);
        appendMessage("Omlouvam se, chat nebylo mozne ulozit.", 'ai');
    }
}

/**
 * Loads all past chat titles for the current user and displays them in the sidebar.
 * Only callable if a user is logged in.
 * @param {string} userId
 */
async function loadPastChats(userId) {
    clearPastChatsList();
    if (!currentUser) {
        pastChatsList.innerHTML = '<p class="text-sm text-slate-500 text-center py-4">Prihlas se, abys videl minule konverzace.</p>';
        return;
    }
    try {
        const chatsRef = collection(db, `users/${userId}/chats`);
        const q = query(chatsRef, orderBy("lastUpdated", "desc"));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            pastChatsList.innerHTML = '<p class="text-sm text-slate-500 text-center py-4">Zatim zadne minule konverzace.</p>';
            return;
        }

        querySnapshot.forEach((d) => {
            const chatData = d.data();
            const chatItem = document.createElement('div');
            chatItem.id = `chat-${d.id}`;
            chatItem.className = 'chat-item p-3 text-sm text-slate-700 rounded-lg mb-2 truncate';
            chatItem.textContent = chatData.title || `Chat ${new Date(chatData.createdAt.toDate()).toLocaleDateString()}`;
            chatItem.dataset.chatId = d.id;
            chatItem.addEventListener('click', () => loadChat(d.id));
            pastChatsList.appendChild(chatItem);
        });
        highlightActiveChat(currentChatId);
    } catch (error) {
        console.error("Error loading past chats:", error);
        pastChatsList.innerHTML = '<p class="text-red-500 text-sm text-center py-4">Chyba pri nacitani konverzaci.</p>';
    }
}

/**
 * Handles processing and sending a standard user message.
 * @param {string} messageText
 */
async function handleUserMessage(messageText) {
    const userMessage = messageText.trim();
    if (!userMessage) return;

    if (!chatWindow.querySelector('.message-bubble:not(#initial-message)')) {
        initialMessage.style.display = 'none';
    }

    appendMessage(userMessage, 'user');
    messageInput.value = '';

    currentChatHistory.push({ role: "user", parts: [{ text: userMessage }] });

    showTypingIndicator();
    try {
        const aiResponse = await getGeminiResponse(currentChatHistory);
        removeTypingIndicator();
        appendMessage(aiResponse, 'ai');
        currentChatHistory.push({ role: "model", parts: [{ text: aiResponse }] });

        if (currentUser) {
            await saveChatToFirestore(currentChatId, currentChatHistory);
        } else {
            console.log("Guest session: chat not saved to Firestore.");
        }
    } catch (error) {
        handleApiError(error);
    }
}

/**
 * Handles a special feature request (recipe, trip).
 * @param {string} prompt - The specific prompt for the feature.
 * @param {string} userFacingText - The text to show in the user's message bubble.
 */
async function handleFeatureRequest(prompt, userFacingText) {
    if (!chatWindow.querySelector('.message-bubble:not(#initial-message)')) {
        initialMessage.style.display = 'none';
    }

    appendMessage(userFacingText, 'user');
    messageInput.value = '';

    const featureChatHistory = [
        ...currentChatHistory,
        { role: "user", parts: [{ text: prompt }] }
    ];

    showTypingIndicator();
    try {
        const aiResponse = await getGeminiResponse(featureChatHistory);
        removeTypingIndicator();
        appendMessage(aiResponse, 'ai');
        currentChatHistory.push({ role: "user", parts: [{ text: userFacingText }] });
        currentChatHistory.push({ role: "model", parts: [{ text: aiResponse }] });

        if (currentUser) {
            await saveChatToFirestore(currentChatId, currentChatHistory);
        } else {
            console.log("Guest session: feature chat not saved to Firestore.");
        }
    } catch (error) {
        handleApiError(error);
    }
}

/**
 * Fetches a response from the Gemini API.
 * @param {Array} history - The conversation history to send to Gemini.
 * @returns {Promise<string>} The AI's response text.
 */
async function getGeminiResponse(history) {
    const payload = {
        contents: history,
        safetySettings: [
            { "category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE" },
            { "category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_MEDIUM_AND_ABOVE" },
            { "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_MEDIUM_AND_ABOVE" },
            { "category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE" }
        ]
    };

    const apiKey = GOOGLE_API_KEY;
    // CHANGE THE MODEL HERE TO 'gemini-2.5-flash-lite'
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`;

    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`API request failed with status ${response.status}: ${errorBody}`);
    }

    const result = await response.json();

    if (result.candidates && result.candidates.length > 0 &&
        result.candidates[0].content && result.candidates[0].content.parts &&
        result.candidates[0].content.parts.length > 0) {
        return result.candidates[0].content.parts[0].text;
    } else if (result.promptFeedback && result.promptFeedback.blockReason) {
        console.warn("Prompt blocked:", result.promptFeedback.blockReason);
        return "Promin, na tohle nemuzu odpovedet.";
    } else {
        console.warn("Unexpected API response structure:", result);
        return "Neco je spatne, nemam odpoved.";
    }
}

/**
 * Handles API errors gracefully.
 * @param {Error} error
 */
function handleApiError(error) {
    console.error("Error fetching AI response:", error);
    removeTypingIndicator();
    appendMessage("Omlouvam se, neco se pokazilo. Zkontroluj prosim API klic a pripojeni k internetu.", 'ai');
}

/**
 * Appends a message to the chat window.
 * @param {string} text - The message content.
 * @param {'user' | 'ai'} sender - Who sent the message.
 */
function appendMessage(text, sender) {
    const messageWrapper = document.createElement('div');
    messageWrapper.className = 'message-bubble flex flex-col';

    const messageElement = document.createElement('div');
    messageElement.classList.add('p-4', 'shadow-sm', 'max-w-lg');

    const paragraph = document.createElement('p');
    paragraph.innerHTML = text.replace(/\n/g, '<br>');

    if (sender === 'user') {
        messageWrapper.classList.add('self-end', 'items-end');
        messageElement.classList.add('bg-indigo-500', 'text-white', 'rounded-2xl', 'rounded-br-lg');
    } else {
        messageWrapper.classList.add('self-start', 'items-start');
        messageElement.classList.add('bg-white', 'text-slate-700', 'rounded-2xl', 'rounded-bl-lg');
    }

    messageElement.appendChild(paragraph);
    messageWrapper.appendChild(messageElement);
    chatWindow.appendChild(messageWrapper);

    chatWindow.scrollTop = chatWindow.scrollHeight;
}

/**
 * Clears all messages from the chat window.
 */
function clearChatWindow() {
    chatWindow.innerHTML = '';
    if (initialMessage.parentNode !== chatWindow) {
        chatWindow.appendChild(initialMessage);
    }
    initialMessage.style.display = 'block';
}

/**
 * Clears all chat items from the past chats sidebar list.
 */
function clearPastChatsList() {
    pastChatsList.innerHTML = '';
}

/**
 * Shows a typing indicator in the chat window.
 */
function showTypingIndicator() {
    const indicator = document.createElement('div');
    indicator.id = 'typing-indicator';
    indicator.className = 'message-bubble self-start flex items-center gap-2 bg-white rounded-2xl rounded-bl-lg p-4 shadow-sm';
    indicator.innerHTML = `
        <div class="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style="animation-delay: 0s;"></div>
        <div class="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style="animation-delay: 0.1s;"></div>
        <div class="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style="animation-delay: 0.2s;"></div>
    `;
    chatWindow.appendChild(indicator);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

/**
 * Removes the typing indicator from the chat window.
 */
function removeTypingIndicator() {
    const indicator = document.getElementById('typing-indicator');
    if (indicator) {
        indicator.remove();
    }
}

/**
 * Enables or disables chat-related input fields and buttons.
 * @param {boolean} disable - True to disable, false to enable.
 */
function disableChatInputs(disable) {
    messageInput.disabled = disable;
    sendButton.disabled = disable;
    recipeBtn.disabled = disable;
    tripBtn.disabled = disable;
    refreshChatBtn.disabled = disable;
    newChatBtn.disabled = disable || !currentUser;
    hamburgerBtn.disabled = (GOOGLE_API_KEY === "YOUR_API_KEY_HERE" || !GOOGLE_API_KEY);
    settingsBtn.disabled = (GOOGLE_API_KEY === "YOUR_API_KEY_HERE" || !GOOGLE_API_KEY);
}

/**
 * Generates an AI-summarized title for a chat based on its history.
 * This will make an additional API call.
 * @param {Array} chatHistory - The chat history array (excluding system prompt).
 * @returns {Promise<string>} The generated title.
 */
async function generateChatTitle(chatHistory) {
    if (chatHistory.length === 0) {
        return "Novy Chat";
    }

    const recentMessages = chatHistory.slice(-5);
    const summaryConversation = [
        { role: "user", parts: [{ text: summaryPrompt }] },
        ...recentMessages.map(msg => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.parts[0].text }]
        }))
    ];

    try {
        const titleResponse = await getGeminiResponse(summaryConversation);
        // We expect the AI to return only the title, but strip any potential leading/trailing quotes or spaces just in case.
        return titleResponse.replace(/^["']|["']$/g, '').trim();
    } catch (error) {
        console.error("Error generating chat title:", error);
        const firstUserMessage = chatHistory.find(msg => msg.role === 'user');
        if (firstUserMessage) {
            let title = firstUserMessage.parts[0].text.substring(0, 30);
            if (firstUserMessage.parts[0].text.length > 30) {
                title += "...";
            }
            return title;
        }
        return "Nepojmenovany Chat";
    }
}

/**
 * Highlights the active chat in the sidebar.
 * @param {string|null} activeChatId - The ID of the currently active chat, or null if none.
 */
function highlightActiveChat(activeChatId) {
    const chatItems = pastChatsList.querySelectorAll('.chat-item');
    chatItems.forEach(item => {
        if (item.dataset.chatId === activeChatId) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
}
