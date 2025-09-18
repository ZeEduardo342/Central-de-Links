// Firebase Configuration and Imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    getDocs, 
    doc, 
    updateDoc, 
    deleteDoc, 
    query, 
    orderBy,
    onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyATPxgEAjC2EcRmpAnzHRB7bUpeG2pY-pU",
    authDomain: "central-de-links-cmp.firebaseapp.com",
    projectId: "central-de-links-cmp",
    storageBucket: "central-de-links-cmp.firebasestorage.app",
    messagingSenderId: "502211758516",
    appId: "1:502211758516:web:541ae82f18ad98178c8ae1"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Application State
class AppState {
    constructor() {
        this.isAdmin = false;
        this.currentCategory = 'all';
        this.theme = localStorage.getItem('theme') || 'light';
        this.sidebarCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
        this.links = [];
        this.categories = [];
        this.searchQuery = '';
        this.editingLink = null;
        
        this.init();
    }
    
    init() {
        this.applyTheme();
        this.applySidebarState();
        this.bindEvents();
        this.loadData();
        
        // Auto logout on page reload
        this.logout();
    }
    
    applyTheme() {
        document.documentElement.setAttribute('data-theme', this.theme);
        const themeIcon = document.querySelector('#themeToggle i');
        themeIcon.className = this.theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    }
    
    applySidebarState() {
        const sidebar = document.getElementById('sidebar');
        if (this.sidebarCollapsed) {
            sidebar.classList.add('collapsed');
        }
    }
    
    bindEvents() {
        // Theme toggle
        document.getElementById('themeToggle').addEventListener('click', () => {
            this.toggleTheme();
        });
        
        // Sidebar toggle
        document.getElementById('sidebarToggle').addEventListener('click', () => {
            this.toggleSidebar();
        });
        
        // Admin toggle
        document.getElementById('adminToggle').addEventListener('click', () => {
            if (this.isAdmin) {
                this.logout();
            } else {
                this.showLoginModal();
            }
        });
        
        // Search
        document.getElementById('searchInput').addEventListener('input', (e) => {
            this.searchQuery = e.target.value.toLowerCase();
            this.renderLinks();
        });
        
        // Modal events
        this.bindModalEvents();
        
        // Form events
        this.bindFormEvents();
    }
    
    bindModalEvents() {
        // Close modals
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.closeModal(e.target.closest('.modal'));
            });
        });
        
        // Close modal on backdrop click
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal(modal);
                }
            });
        });
        
        // Cancel buttons
        document.getElementById('cancelLinkBtn').addEventListener('click', () => {
            this.closeModal(document.getElementById('linkModal'));
        });
        
        document.getElementById('cancelCategoryBtn').addEventListener('click', () => {
            this.closeModal(document.getElementById('categoryModal'));
        });
        
        document.getElementById('cancelConfirmBtn').addEventListener('click', () => {
            this.closeModal(document.getElementById('confirmModal'));
        });
    }
    
    bindFormEvents() {
        // Login form
        document.getElementById('loginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });
        
        // Link form
        document.getElementById('linkForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLinkSubmit();
        });
        
        // Category form
        document.getElementById('categoryForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleCategorySubmit();
        });
        
        // Add link button
        document.getElementById('addLinkBtn').addEventListener('click', () => {
            this.showLinkModal();
        });
        
        // Add category button
        document.getElementById('addCategoryBtn').addEventListener('click', () => {
            this.showCategoryModal();
        });
    }
    
    toggleTheme() {
        this.theme = this.theme === 'light' ? 'dark' : 'light';
        localStorage.setItem('theme', this.theme);
        this.applyTheme();
        this.showToast('Tema alterado com sucesso!', 'success');
    }
    
    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        this.sidebarCollapsed = !this.sidebarCollapsed;
        localStorage.setItem('sidebarCollapsed', this.sidebarCollapsed);
        
        if (this.sidebarCollapsed) {
            sidebar.classList.add('collapsed');
        } else {
            sidebar.classList.remove('collapsed');
        }
    }
    
    showLoginModal() {
        this.showModal('loginModal');
        document.getElementById('adminPassword').focus();
    }
    
    handleLogin() {
        const password = document.getElementById('adminPassword').value;
        
        // Simple password check (in production, use proper authentication)
        if (password === 'admin123') {
            this.isAdmin = true;
            this.updateAdminUI();
            this.closeModal(document.getElementById('loginModal'));
            this.showToast('Login realizado com sucesso!', 'success');
            document.getElementById('adminPassword').value = '';
        } else {
            this.showToast('Senha incorreta!', 'error');
        }
    }
    
    logout() {
        this.isAdmin = false;
        this.updateAdminUI();
        this.showToast('Logout realizado com sucesso!', 'success');
    }
    
    updateAdminUI() {
        const adminToggle = document.getElementById('adminToggle');
        const addLinkBtn = document.getElementById('addLinkBtn');
        const adminSidebarFooter = document.getElementById('adminSidebarFooter');
        
        if (this.isAdmin) {
            adminToggle.classList.add('active');
            addLinkBtn.style.display = 'flex';
            adminSidebarFooter.style.display = 'block';
        } else {
            adminToggle.classList.remove('active');
            addLinkBtn.style.display = 'none';
            adminSidebarFooter.style.display = 'none';
        }
        
        this.renderLinks();
    }
    
    async loadData() {
        this.showLoading(true);
        
        try {
            await Promise.all([
                this.loadCategories(),
                this.loadLinks()
            ]);
        } catch (error) {
            console.error('Error loading data:', error);
            this.showToast('Erro ao carregar dados!', 'error');
        } finally {
            this.showLoading(false);
        }
    }
    
    async loadCategories() {
        try {
            const q = query(collection(db, 'categories'), orderBy('name'));
            const querySnapshot = await getDocs(q);
            
            this.categories = [];
            querySnapshot.forEach((doc) => {
                this.categories.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            
            // Add default categories if none exist
            if (this.categories.length === 0) {
                await this.createDefaultCategories();
            }
            
            this.renderCategories();
        } catch (error) {
            console.error('Error loading categories:', error);
        }
    }
    
    async createDefaultCategories() {
        const defaultCategories = [
            { name: 'Designs Figma', icon: 'fas fa-palette' },
            { name: 'Apresentações', icon: 'fas fa-presentation' },
            { name: 'Links Externos', icon: 'fas fa-external-link-alt' },
            { name: 'Documentos', icon: 'fas fa-file-alt' },
            { name: 'Ferramentas', icon: 'fas fa-tools' }
        ];
        
        for (const category of defaultCategories) {
            await addDoc(collection(db, 'categories'), {
                ...category,
                createdAt: new Date()
            });
        }
        
        await this.loadCategories();
    }
    
    async loadLinks() {
        try {
            const q = query(collection(db, 'links'), orderBy('createdAt', 'desc'));
            const querySnapshot = await getDocs(q);
            
            this.links = [];
            querySnapshot.forEach((doc) => {
                this.links.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            
            this.renderLinks();
        } catch (error) {
            console.error('Error loading links:', error);
        }
    }
    
    renderCategories() {
        const categoriesList = document.getElementById('categoriesList');
        
        let html = `
            <li class="category-item">
                <a href="#" class="category-link ${this.currentCategory === 'all' ? 'active' : ''}" data-category="all">
                    <i class="category-icon fas fa-th-large"></i>
                    <span class="category-name">Todos os Links</span>
                </a>
            </li>
            <li class="category-item">
                <a href="#" class="category-link ${this.currentCategory === 'favorites' ? 'active' : ''}" data-category="favorites">
                    <i class="category-icon fas fa-star"></i>
                    <span class="category-name">Favoritos</span>
                </a>
            </li>
        `;
        
        this.categories.forEach(category => {
            html += `
                <li class="category-item">
                    <a href="#" class="category-link ${this.currentCategory === category.id ? 'active' : ''}" data-category="${category.id}">
                        <i class="category-icon ${category.icon}"></i>
                        <span class="category-name">${category.name}</span>
                    </a>
                </li>
            `;
        });
        
        categoriesList.innerHTML = html;
        
        // Bind category click events
        categoriesList.querySelectorAll('.category-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                this.selectCategory(e.target.closest('.category-link').dataset.category);
            });
        });
        
        // Update category select in forms
        this.updateCategorySelects();
    }
    
    updateCategorySelects() {
        const linkCategorySelect = document.getElementById('linkCategory');
        
        let options = '';
        this.categories.forEach(category => {
            options += `<option value="${category.id}">${category.name}</option>`;
        });
        
        linkCategorySelect.innerHTML = options;
    }
    
    selectCategory(categoryId) {
        this.currentCategory = categoryId;
        
        // Update active category in sidebar
        document.querySelectorAll('.category-link').forEach(link => {
            link.classList.remove('active');
        });
        document.querySelector(`[data-category="${categoryId}"]`).classList.add('active');
        
        // Update section title
        const title = document.getElementById('currentCategoryTitle');
        if (categoryId === 'all') {
            title.textContent = 'Todos os Links';
        } else if (categoryId === 'favorites') {
            title.textContent = 'Favoritos';
        } else {
            const category = this.categories.find(c => c.id === categoryId);
            title.textContent = category ? category.name : 'Categoria';
        }
        
        this.renderLinks();
    }
    
    renderLinks() {
        const linksList = document.getElementById('linksList');
        const favoritesList = document.getElementById('favoritesList');
        const emptyState = document.getElementById('emptyState');
        const favoritesSection = document.getElementById('favoritesSection');
        
        let filteredLinks = this.links;
        
        // Filter by search query
        if (this.searchQuery) {
            filteredLinks = filteredLinks.filter(link => 
                link.title.toLowerCase().includes(this.searchQuery) ||
                link.url.toLowerCase().includes(this.searchQuery) ||
                (link.description && link.description.toLowerCase().includes(this.searchQuery)) ||
                (link.tags && link.tags.some(tag => tag.toLowerCase().includes(this.searchQuery)))
            );
        }
        
        // Filter by category
        if (this.currentCategory !== 'all' && this.currentCategory !== 'favorites') {
            filteredLinks = filteredLinks.filter(link => link.categoryId === this.currentCategory);
        }
        
        // Render favorites
        const favoriteLinks = this.links.filter(link => link.favorite);
        if (favoriteLinks.length > 0) {
            favoritesSection.style.display = 'block';
            favoritesList.innerHTML = favoriteLinks.map(link => this.createLinkCard(link)).join('');
        } else {
            favoritesSection.style.display = 'none';
        }
        
        // Render main links
        if (this.currentCategory === 'favorites') {
            linksList.innerHTML = favoriteLinks.map(link => this.createLinkCard(link)).join('');
        } else {
            linksList.innerHTML = filteredLinks.map(link => this.createLinkCard(link)).join('');
        }
        
        // Show empty state if no links
        if (filteredLinks.length === 0 && this.currentCategory !== 'favorites') {
            emptyState.style.display = 'block';
        } else {
            emptyState.style.display = 'none';
        }
        
        // Bind link events
        this.bindLinkEvents();
    }
    
    createLinkCard(link) {
        const category = this.categories.find(c => c.id === link.categoryId);
        const categoryName = category ? category.name : 'Sem categoria';
        const categoryIcon = category ? category.icon : 'fas fa-folder';
        
        const tags = link.tags ? link.tags.map(tag => `<span class="tag">${tag}</span>`).join('') : '';
        
        const adminActions = this.isAdmin ? `
            <div class="link-actions">
                <button class="link-action favorite ${link.favorite ? 'active' : ''}" data-action="favorite" data-id="${link.id}">
                    <i class="fas fa-star"></i>
                </button>
                <button class="link-action" data-action="edit" data-id="${link.id}">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="link-action" data-action="delete" data-id="${link.id}">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        ` : '';
        
        return `
            <div class="link-card ${!link.active ? 'inactive' : ''}" data-id="${link.id}">
                <div class="link-header">
                    <div>
                        <h3 class="link-title">${link.title}</h3>
                        <div class="link-url">${link.url}</div>
                    </div>
                    ${adminActions}
                </div>
                ${link.description ? `<p class="link-description">${link.description}</p>` : ''}
                ${tags ? `<div class="link-tags">${tags}</div>` : ''}
                <div class="link-footer">
                    <div class="link-category">
                        <i class="${categoryIcon}"></i>
                        <span>${categoryName}</span>
                    </div>
                    <div class="link-date">${this.formatDate(link.createdAt)}</div>
                </div>
            </div>
        `;
    }
    
    bindLinkEvents() {
        // Link card clicks
        document.querySelectorAll('.link-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('.link-actions')) return;
                
                const linkId = card.dataset.id;
                const link = this.links.find(l => l.id === linkId);
                
                if (link && link.active) {
                    window.open(link.url, '_blank');
                    this.incrementClickCount(linkId);
                } else if (link) {
                    this.showLinkDetails(link);
                }
            });
        });
        
        // Action buttons
        document.querySelectorAll('.link-action').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = btn.dataset.action;
                const linkId = btn.dataset.id;
                
                switch (action) {
                    case 'favorite':
                        this.toggleFavorite(linkId);
                        break;
                    case 'edit':
                        this.editLink(linkId);
                        break;
                    case 'delete':
                        this.confirmDeleteLink(linkId);
                        break;
                }
            });
        });
    }
    
    async incrementClickCount(linkId) {
        try {
            const link = this.links.find(l => l.id === linkId);
            const newCount = (link.clickCount || 0) + 1;
            
            await updateDoc(doc(db, 'links', linkId), {
                clickCount: newCount,
                lastAccessed: new Date()
            });
            
            // Update local state
            link.clickCount = newCount;
            link.lastAccessed = new Date();
        } catch (error) {
            console.error('Error updating click count:', error);
        }
    }
    
    async toggleFavorite(linkId) {
        try {
            const link = this.links.find(l => l.id === linkId);
            const newFavoriteState = !link.favorite;
            
            await updateDoc(doc(db, 'links', linkId), {
                favorite: newFavoriteState
            });
            
            // Update local state
            link.favorite = newFavoriteState;
            this.renderLinks();
            
            this.showToast(
                newFavoriteState ? 'Adicionado aos favoritos!' : 'Removido dos favoritos!',
                'success'
            );
        } catch (error) {
            console.error('Error toggling favorite:', error);
            this.showToast('Erro ao atualizar favorito!', 'error');
        }
    }
    
    showLinkModal(link = null) {
        this.editingLink = link;
        const modal = document.getElementById('linkModal');
        const title = document.getElementById('linkModalTitle');
        const form = document.getElementById('linkForm');
        
        title.textContent = link ? 'Editar Link' : 'Adicionar Link';
        
        if (link) {
            document.getElementById('linkTitle').value = link.title;
            document.getElementById('linkUrl').value = link.url;
            document.getElementById('linkCategory').value = link.categoryId;
            document.getElementById('linkTags').value = link.tags ? link.tags.join(', ') : '';
            document.getElementById('linkDescription').value = link.description || '';
            document.getElementById('linkFavorite').checked = link.favorite || false;
            document.getElementById('linkActive').checked = link.active !== false;
        } else {
            form.reset();
            document.getElementById('linkActive').checked = true;
        }
        
        this.showModal('linkModal');
        document.getElementById('linkTitle').focus();
    }
    
    async handleLinkSubmit() {
        const title = document.getElementById('linkTitle').value.trim();
        const url = document.getElementById('linkUrl').value.trim();
        const categoryId = document.getElementById('linkCategory').value;
        const tags = document.getElementById('linkTags').value.split(',').map(tag => tag.trim()).filter(tag => tag);
        const description = document.getElementById('linkDescription').value.trim();
        const favorite = document.getElementById('linkFavorite').checked;
        const active = document.getElementById('linkActive').checked;
        
        if (!title || !url || !categoryId) {
            this.showToast('Preencha todos os campos obrigatórios!', 'error');
            return;
        }
        
        this.showLoading(true);
        
        try {
            const linkData = {
                title,
                url,
                categoryId,
                tags,
                description,
                favorite,
                active,
                updatedAt: new Date()
            };
            
            if (this.editingLink) {
                await updateDoc(doc(db, 'links', this.editingLink.id), linkData);
                this.showToast('Link atualizado com sucesso!', 'success');
            } else {
                linkData.createdAt = new Date();
                linkData.clickCount = 0;
                await addDoc(collection(db, 'links'), linkData);
                this.showToast('Link adicionado com sucesso!', 'success');
            }
            
            this.closeModal(document.getElementById('linkModal'));
            await this.loadLinks();
        } catch (error) {
            console.error('Error saving link:', error);
            this.showToast('Erro ao salvar link!', 'error');
        } finally {
            this.showLoading(false);
        }
    }
    
    editLink(linkId) {
        const link = this.links.find(l => l.id === linkId);
        if (link) {
            this.showLinkModal(link);
        }
    }
    
    confirmDeleteLink(linkId) {
        const link = this.links.find(l => l.id === linkId);
        if (!link) return;
        
        document.getElementById('confirmMessage').textContent = 
            `Tem certeza que deseja excluir o link "${link.title}"?`;
        
        this.showModal('confirmModal');
        
        document.getElementById('confirmActionBtn').onclick = () => {
            this.deleteLink(linkId);
            this.closeModal(document.getElementById('confirmModal'));
        };
    }
    
    async deleteLink(linkId) {
        this.showLoading(true);
        
        try {
            await deleteDoc(doc(db, 'links', linkId));
            this.showToast('Link excluído com sucesso!', 'success');
            await this.loadLinks();
        } catch (error) {
            console.error('Error deleting link:', error);
            this.showToast('Erro ao excluir link!', 'error');
        } finally {
            this.showLoading(false);
        }
    }
    
    showLinkDetails(link) {
        const modal = document.getElementById('linkDetailsModal');
        const title = document.getElementById('linkDetailsTitle');
        const content = document.getElementById('linkDetailsContent');
        const actions = document.getElementById('linkDetailsActions');
        
        title.textContent = link.title;
        
        const category = this.categories.find(c => c.id === link.categoryId);
        const categoryName = category ? category.name : 'Sem categoria';
        const tags = link.tags ? link.tags.map(tag => `<span class="tag">${tag}</span>`).join('') : 'Nenhuma tag';
        
        content.innerHTML = `
            <div class="form-group">
                <label>URL:</label>
                <p><a href="${link.url}" target="_blank">${link.url}</a></p>
            </div>
            <div class="form-group">
                <label>Categoria:</label>
                <p>${categoryName}</p>
            </div>
            ${link.description ? `
                <div class="form-group">
                    <label>Descrição:</label>
                    <p>${link.description}</p>
                </div>
            ` : ''}
            <div class="form-group">
                <label>Tags:</label>
                <div class="link-tags">${tags}</div>
            </div>
            <div class="form-group">
                <label>Status:</label>
                <p>${link.active ? 'Ativo' : 'Inativo'}</p>
            </div>
            <div class="form-group">
                <label>Favorito:</label>
                <p>${link.favorite ? 'Sim' : 'Não'}</p>
            </div>
            <div class="form-group">
                <label>Cliques:</label>
                <p>${link.clickCount || 0}</p>
            </div>
            <div class="form-group">
                <label>Criado em:</label>
                <p>${this.formatDate(link.createdAt)}</p>
            </div>
        `;
        
        if (this.isAdmin) {
            actions.style.display = 'flex';
            document.getElementById('editLinkBtn').onclick = () => {
                this.closeModal(modal);
                this.editLink(link.id);
            };
            document.getElementById('deleteLinkBtn').onclick = () => {
                this.closeModal(modal);
                this.confirmDeleteLink(link.id);
            };
        } else {
            actions.style.display = 'none';
        }
        
        this.showModal('linkDetailsModal');
    }
    
    showCategoryModal() {
        this.showModal('categoryModal');
        document.getElementById('categoryName').focus();
    }
    
    async handleCategorySubmit() {
        const name = document.getElementById('categoryName').value.trim();
        const icon = document.getElementById('categoryIcon').value.trim();
        
        if (!name) {
            this.showToast('Digite o nome da categoria!', 'error');
            return;
        }
        
        this.showLoading(true);
        
        try {
            await addDoc(collection(db, 'categories'), {
                name,
                icon: icon || 'fas fa-folder',
                createdAt: new Date()
            });
            
            this.showToast('Categoria criada com sucesso!', 'success');
            this.closeModal(document.getElementById('categoryModal'));
            await this.loadCategories();
        } catch (error) {
            console.error('Error creating category:', error);
            this.showToast('Erro ao criar categoria!', 'error');
        } finally {
            this.showLoading(false);
        }
    }
    
    showModal(modalId) {
        const modal = document.getElementById(modalId);
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
    }
    
    closeModal(modal) {
        modal.classList.remove('show');
        document.body.style.overflow = '';
        
        // Reset forms
        const forms = modal.querySelectorAll('form');
        forms.forEach(form => form.reset());
        
        this.editingLink = null;
    }
    
    showLoading(show) {
        const overlay = document.getElementById('loadingOverlay');
        if (show) {
            overlay.classList.add('show');
        } else {
            overlay.classList.remove('show');
        }
    }
    
    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <div>${message}</div>
        `;
        
        container.appendChild(toast);
        
        // Auto remove after 3 seconds
        setTimeout(() => {
            toast.remove();
        }, 3000);
    }
    
    formatDate(date) {
        if (!date) return '';
        
        const d = date.toDate ? date.toDate() : new Date(date);
        return d.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    window.app = new AppState();
});

// Handle mobile sidebar
document.addEventListener('DOMContentLoaded', () => {
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebarToggle');
    
    // Close sidebar on mobile when clicking outside
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768) {
            if (!sidebar.contains(e.target) && !sidebarToggle.contains(e.target)) {
                sidebar.classList.remove('show');
            }
        }
    });
    
    // Toggle sidebar on mobile
    sidebarToggle.addEventListener('click', () => {
        if (window.innerWidth <= 768) {
            sidebar.classList.toggle('show');
        }
    });
});

// Export for potential external use
export { AppState };

