// Configuration Supabase
const SUPABASE_URL = 'https://ugjazzvwotlcoxvkibzu.supabase.co ';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVnamF6enZ3b3RsY294dmtpYnp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzNjk1NzksImV4cCI6MjA4Njk0NTU3OX0.pJkv34B8y7L3UZWuWbukJajCuQvafZIDYS2cz0r-qCc ';
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Variables globales
let currentUser = null;
let currentConversation = null;
let currentConversationType = null;
let mediaRecorder = null;
let audioChunks = [];
let recordingInterval = null;
let selectedFiles = [];
let conversations = [];
let contacts = [];
let groups = [];
let messagesSubscription = null;

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
    checkUser();
    setupEventListeners();
});

// Vérifier si l'utilisateur est connecté
async function checkUser() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
        currentUser = user;
        await loadUserProfile();
        showChatPage();
        loadContacts();
        loadGroups();
        loadConversations();
        setupRealtimeSubscriptions();
    } else {
        showAuthPage();
    }
}

// Configuration des écouteurs d'événements
function setupEventListeners() {
    // Formulaire de connexion
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });
        
        if (error) {
            alert('Erreur de connexion: ' + error.message);
        } else {
            currentUser = data.user;
            await loadUserProfile();
            showChatPage();
            loadContacts();
            loadGroups();
            loadConversations();
            setupRealtimeSubscriptions();
        }
    });
    
    // Formulaire d'inscription
    document.getElementById('register-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const nom = document.getElementById('register-nom').value;
        const prenom = document.getElementById('register-prenom').value;
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    nom,
                    prenom
                }
            }
        });
        
        if (error) {
            alert('Erreur d\'inscription: ' + error.message);
        } else {
            // Créer le profil utilisateur
            await supabase.from('profiles').insert([
                {
                    id: data.user.id,
                    nom,
                    prenom,
                    email
                }
            ]);
            
            alert('Inscription réussie ! Vous pouvez maintenant vous connecter.');
            showTab('login');
        }
    });
    
    // Recherche d'utilisateurs
    document.getElementById('search-users').addEventListener('input', debounce(searchUsers, 300));
    
    // Message input auto-resize
    document.getElementById('message-input').addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
    });
}

// Charger le profil utilisateur
async function loadUserProfile() {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();
    
    if (data) {
        currentUser.profile = data;
        document.getElementById('user-name').textContent = `${data.prenom} ${data.nom}`;
        document.getElementById('user-email').textContent = data.email;
        document.getElementById('user-avatar').textContent = data.prenom.charAt(0);
    }
}

// Afficher la page de chat
function showChatPage() {
    document.getElementById('auth-page').classList.remove('active');
    document.getElementById('chat-page').classList.add('active');
}

// Afficher la page d'authentification
function showAuthPage() {
    document.getElementById('chat-page').classList.remove('active');
    document.getElementById('auth-page').classList.add('active');
}

// Changer d'onglet d'authentification
function showTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach(form => form.classList.remove('active'));
    
    if (tab === 'login') {
        document.querySelectorAll('.tab-btn')[0].classList.add('active');
        document.getElementById('login-form').classList.add('active');
    } else {
        document.querySelectorAll('.tab-btn')[1].classList.add('active');
        document.getElementById('register-form').classList.add('active');
    }
}

// Changer d'onglet dans la messagerie
function switchTab(tab) {
    document.querySelectorAll('.tabs .tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.contacts-list, .groups-list, .discussions-list').forEach(list => list.classList.remove('active'));
    
    if (tab === 'contacts') {
        document.querySelectorAll('.tabs .tab-btn')[2].classList.add('active');
        document.getElementById('contacts-list').classList.add('active');
    } else if (tab === 'groups') {
        document.querySelectorAll('.tabs .tab-btn')[1].classList.add('active');
        document.getElementById('groups-list').classList.add('active');
    } else {
        document.querySelectorAll('.tabs .tab-btn')[0].classList.add('active');
        document.getElementById('discussions-list').classList.add('active');
    }
}

// Charger les contacts
async function loadContacts() {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .neq('id', currentUser.id);
    
    if (data) {
        contacts = data;
        displayContacts(data);
    }
}

// Afficher les contacts
function displayContacts(contacts) {
    const contactsList = document.getElementById('contacts-list');
    contactsList.innerHTML = '';
    
    contacts.forEach(contact => {
        const contactElement = createContactElement(contact);
        contactsList.appendChild(contactElement);
    });
}

// Créer un élément contact
function createContactElement(contact) {
    const div = document.createElement('div');
    div.className = 'contact-item';
    div.onclick = () => startConversation(contact, 'contact');
    
    div.innerHTML = `
        <div class="contact-avatar">${contact.prenom.charAt(0)}</div>
        <div class="contact-info">
            <div class="contact-name">${contact.prenom} ${contact.nom}</div>
            <div class="contact-email">${contact.email}</div>
        </div>
    `;
    
    return div;
}

// Charger les groupes
async function loadGroups() {
    const { data, error } = await supabase
        .from('group_members')
        .select('groups(*)')
        .eq('user_id', currentUser.id);
    
    if (data) {
        groups = data.map(d => d.groups);
        displayGroups(groups);
    }
}

// Afficher les groupes
function displayGroups(groups) {
    const groupsList = document.getElementById('groups-list');
    groupsList.innerHTML = '';
    
    groups.forEach(group => {
        const groupElement = createGroupElement(group);
        groupsList.appendChild(groupElement);
    });
}

// Créer un élément groupe
function createGroupElement(group) {
    const div = document.createElement('div');
    div.className = 'group-item';
    div.onclick = () => startConversation(group, 'group');
    
    div.innerHTML = `
        <div class="group-avatar">G</div>
        <div class="group-info">
            <div class="group-name">${group.name}</div>
            <div class="group-members">${group.members_count || 0} membres</div>
        </div>
    `;
    
    return div;
}

// Charger les conversations récentes
async function loadConversations() {
    // Charger les messages récents pour créer des conversations
    const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`)
        .order('created_at', { ascending: false });
    
    if (data) {
        // Traiter les données pour créer des conversations uniques
        const conversationMap = new Map();
        
        data.forEach(message => {
            const otherId = message.sender_id === currentUser.id ? message.receiver_id : message.sender_id;
            if (!conversationMap.has(otherId) && message.conversation_type === 'contact') {
                conversationMap.set(otherId, message);
            }
        });
        
        conversations = Array.from(conversationMap.values());
        displayConversations(conversations);
    }
}

// Afficher les conversations
function displayConversations(conversations) {
    const discussionsList = document.getElementById('discussions-list');
    discussionsList.innerHTML = '';
    
    conversations.forEach(async (conversation) => {
        const otherId = conversation.sender_id === currentUser.id ? conversation.receiver_id : conversation.sender_id;
        const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', otherId)
            .single();
        
        if (profile) {
            const conversationElement = createConversationElement(profile, conversation);
            discussionsList.appendChild(conversationElement);
        }
    });
}

// Créer un élément conversation
function createConversationElement(profile, lastMessage) {
    const div = document.createElement('div');
    div.className = 'discussion-item';
    div.onclick = () => startConversation(profile, 'contact');
    
    div.innerHTML = `
        <div class="discussion-avatar">${profile.prenom.charAt(0)}</div>
        <div class="discussion-info">
            <div class="discussion-name">${profile.prenom} ${profile.nom}</div>
            <div class="discussion-preview">${lastMessage.content || 'Fichier'}</div>
        </div>
    `;
    
    return div;
}

// Rechercher des utilisateurs
async function searchUsers(query) {
    if (query.length < 2) {
        displayContacts(contacts);
        return;
    }
    
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .or(`nom.ilike.%${query}%,prenom.ilike.%${query}%`)
        .neq('id', currentUser.id);
    
    if (data) {
        displayContacts(data);
    }
}

// Commencer une conversation
async function startConversation(target, type) {
    currentConversation = target;
    currentConversationType = type;
    
    // Mettre à jour l'en-tête
    document.getElementById('chat-name').textContent = type === 'contact' 
        ? `${target.prenom} ${target.nom}`
        : target.name;
    document.getElementById('chat-avatar').textContent = type === 'contact'
        ? target.prenom.charAt(0)
        : 'G';
    
    // Charger les messages
    await loadMessages(target.id, type);
    
    // S'abonner aux nouveaux messages
    setupMessagesSubscription(target.id, type);
}

// Charger les messages
async function loadMessages(targetId, type) {
    let query = supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: true });
    
    if (type === 'contact') {
        query = query.or(
            `and(sender_id.eq.${currentUser.id},receiver_id.eq.${targetId}),` +
            `and(sender_id.eq.${targetId},receiver_id.eq.${currentUser.id})`
        );
    } else {
        query = query.eq('group_id', targetId);
    }
    
    const { data, error } = await query;
    
    if (data) {
        displayMessages(data);
    }
}

// Afficher les messages
function displayMessages(messages) {
    const container = document.getElementById('messages-container');
    container.innerHTML = '';
    
    messages.forEach(message => {
        const messageElement = createMessageElement(message);
        container.appendChild(messageElement);
    });
    
    container.scrollTop = container.scrollHeight;
}

// Créer un élément message
function createMessageElement(message) {
    const div = document.createElement('div');
    div.className = `message ${message.sender_id === currentUser.id ? 'sent' : 'received'}`;
    
    let content = '';
    if (message.type === 'text') {
        content = `<p>${message.content}</p>`;
    } else if (message.type === 'audio') {
        content = `<audio controls src="${message.file_url}"></audio>`;
    } else if (message.type === 'image') {
        content = `<img src="${message.file_url}" alt="Image" onclick="window.open(this.src)">`;
    } else if (message.type === 'video') {
        content = `<video controls src="${message.file_url}"></video>`;
    }
    
    div.innerHTML = `
        <div class="message-content">
            ${content}
            <div class="message-info">
                ${new Date(message.created_at).toLocaleTimeString()}
            </div>
        </div>
    `;
    
    return div;
}

// Envoyer un message
async function sendMessage() {
    const input = document.getElementById('message-input');
    const content = input.value.trim();
    
    if (!content || !currentConversation) return;
    
    const message = {
        sender_id: currentUser.id,
        content: content,
        type: 'text',
        conversation_type: currentConversationType,
        created_at: new Date().toISOString()
    };
    
    if (currentConversationType === 'contact') {
        message.receiver_id = currentConversation.id;
    } else {
        message.group_id = currentConversation.id;
    }
    
    const { data, error } = await supabase
        .from('messages')
        .insert([message]);
    
    if (!error) {
        input.value = '';
        input.style.height = 'auto';
    }
}

// Gérer la sélection de fichiers
function openFileDialog() {
    document.getElementById('file-input').click();
}

function handleFileSelect() {
    const files = document.getElementById('file-input').files;
    selectedFiles = Array.from(files);
    
    if (selectedFiles.length > 0) {
        showFilesPreview();
    }
}

// Afficher l'aperçu des fichiers
function showFilesPreview() {
    const preview = document.getElementById('files-preview');
    preview.innerHTML = '';
    
    selectedFiles.forEach((file, index) => {
        const fileType = file.type.split('/')[0];
        const fileElement = document.createElement('div');
        fileElement.className = 'file-preview';
        
        let previewContent = '';
        if (fileType === 'image') {
            previewContent = `<img src="${URL.createObjectURL(file)}">`;
        } else if (fileType === 'video') {
            previewContent = `<video src="${URL.createObjectURL(file)}"></video>`;
        } else {
            previewContent = `<i class="fas fa-file"></i>`;
        }
        
        fileElement.innerHTML = `
            ${previewContent}
            <div class="file-info">
                <div class="file-name">${file.name}</div>
                <div class="file-size">${(file.size / 1024).toFixed(2)} KB</div>
            </div>
            <i class="fas fa-times file-remove" onclick="removeFile(${index})"></i>
        `;
        
        preview.appendChild(fileElement);
    });
    
    document.getElementById('files-modal').classList.add('active');
}

// Supprimer un fichier de la sélection
function removeFile(index) {
    selectedFiles.splice(index, 1);
    if (selectedFiles.length === 0) {
        closeModal('files-modal');
    } else {
        showFilesPreview();
    }
}

// Envoyer les fichiers
async function sendFiles() {
    closeModal('files-modal');
    
    for (const file of selectedFiles) {
        const fileType = file.type.split('/')[0];
        const fileName = `${Date.now()}_${file.name}`;
        
        // Upload du fichier
        const { data: fileData, error: uploadError } = await supabase.storage
            .from('chat-files')
            .upload(fileName, file);
        
        if (uploadError) {
            console.error('Erreur upload:', uploadError);
            continue;
        }
        
        // Obtenir l'URL publique
        const { data: { publicUrl } } = supabase.storage
            .from('chat-files')
            .getPublicUrl(fileName);
        
        // Créer le message
        const message = {
            sender_id: currentUser.id,
            content: file.name,
            type: fileType,
            file_url: publicUrl,
            conversation_type: currentConversationType,
            created_at: new Date().toISOString()
        };
        
        if (currentConversationType === 'contact') {
            message.receiver_id = currentConversation.id;
        } else {
            message.group_id = currentConversation.id;
        }
        
        await supabase.from('messages').insert([message]);
    }
    
    selectedFiles = [];
}

// Enregistrement audio
async function toggleAudioRecording() {
    if (mediaRecorder) {
        stopAudioRecording();
        return;
    }
    
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        
        mediaRecorder.ondataavailable = event => {
            audioChunks.push(event.data);
        };
        
        mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            const fileName = `${Date.now()}_audio.webm`;
            
            // Upload du fichier audio
            const { data, error } = await supabase.storage
                .from('chat-files')
                .upload(fileName, audioBlob);
            
            if (!error) {
                const { data: { publicUrl } } = supabase.storage
                    .from('chat-files')
                    .getPublicUrl(fileName);
                
                // Créer le message audio
                const message = {
                    sender_id: currentUser.id,
                    content: 'Message audio',
                    type: 'audio',
                    file_url: publicUrl,
                    conversation_type: currentConversationType,
                    created_at: new Date().toISOString()
                };
                
                if (currentConversationType === 'contact') {
                    message.receiver_id = currentConversation.id;
                } else {
                    message.group_id = currentConversation.id;
                }
                
                await supabase.from('messages').insert([message]);
            }
            
            // Arrêter toutes les pistes
            stream.getTracks().forEach(track => track.stop());
            mediaRecorder = null;
        };
        
        mediaRecorder.start();
        startRecordingTimer();
        
        document.getElementById('audio-btn').style.display = 'none';
        document.getElementById('audio-recording').style.display = 'flex';
        
    } catch (error) {
        console.error('Erreur accès micro:', error);
        alert('Impossible d\'accéder au microphone');
    }
}

function stopAudioRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        clearInterval(recordingInterval);
        
        document.getElementById('audio-btn').style.display = 'block';
        document.getElementById('audio-recording').style.display = 'none';
        document.getElementById('recording-timer').textContent = '00:00';
    }
}

function startRecordingTimer() {
    let seconds = 0;
    recordingInterval = setInterval(() => {
        seconds++;
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        document.getElementById('recording-timer').textContent = 
            `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }, 1000);
}

// Gestion des groupes
function showCreateGroup() {
    // Charger les contacts pour la sélection
    const membersList = document.getElementById('group-members-list');
    membersList.innerHTML = '';
    
    contacts.forEach(contact => {
        const memberItem = document.createElement('div');
        memberItem.className = 'member-item';
        memberItem.innerHTML = `
            <input type="checkbox" value="${contact.id}">
            <div class="contact-avatar">${contact.prenom.charAt(0)}</div>
            <div class="contact-info">
                <div class="contact-name">${contact.prenom} ${contact.nom}</div>
            </div>
        `;
        membersList.appendChild(memberItem);
    });
    
    document.getElementById('group-modal').classList.add('active');
}

async function createGroup() {
    const groupName = document.getElementById('group-name').value.trim();
    const selectedMembers = Array.from(document.querySelectorAll('#group-members-list input:checked'))
        .map(input => input.value);
    
    if (!groupName || selectedMembers.length === 0) {
        alert('Veuillez donner un nom au groupe et sélectionner des membres');
        return;
    }
    
    // Ajouter l'utilisateur courant
    selectedMembers.push(currentUser.id);
    
    // Créer le groupe
    const { data: group, error: groupError } = await supabase
        .from('groups')
        .insert([{ name: groupName, created_by: currentUser.id }])
        .select()
        .single();
    
    if (groupError) {
        console.error('Erreur création groupe:', groupError);
        return;
    }
    
    // Ajouter les membres
    const members = selectedMembers.map(userId => ({
        group_id: group.id,
        user_id: userId
    }));
    
    const { error: membersError } = await supabase
        .from('group_members')
        .insert(members);
    
    if (!membersError) {
        closeModal('group-modal');
        await loadGroups();
        startConversation(group, 'group');
    }
}

// Fermer un modal
function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

// Déconnexion
async function logout() {
    await supabase.auth.signOut();
    currentUser = null;
    currentConversation = null;
    
    if (messagesSubscription) {
        messagesSubscription.unsubscribe();
    }
    
    showAuthPage();
}

// Configuration des abonnements en temps réel
function setupRealtimeSubscriptions() {
    // S'abonner aux nouveaux messages
    messagesSubscription = supabase
        .channel('messages')
        .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'messages' 
        }, payload => {
            if (currentConversation) {
                const message = payload.new;
                
                // Vérifier si le message concerne la conversation actuelle
                const isCurrentConversation = (
                    (currentConversationType === 'contact' && 
                     ((message.sender_id === currentConversation.id && message.receiver_id === currentUser.id) ||
                      (message.sender_id === currentUser.id && message.receiver_id === currentConversation.id))) ||
                    (currentConversationType === 'group' && message.group_id === currentConversation.id)
                );
                
                if (isCurrentConversation) {
                    const messageElement = createMessageElement(message);
                    document.getElementById('messages-container').appendChild(messageElement);
                    document.getElementById('messages-container').scrollTop = 
                        document.getElementById('messages-container').scrollHeight;
                }
            }
        })
        .subscribe();
}

// Fonctions utilitaires
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
