import type { Affiliate, DashboardMetrics, AuditLog, User, Document, Notification } from '../types';

const generateId = () => Math.random().toString(36).substring(2, 9);

// --- In-memory data store ---

let mockUsers: User[] = [
    { 
      uid: 'user123', 
      email: 'admin@example.com', 
      role: 'admin',
      fullName: 'Administrador Principal',
      state: 'Ciudad de México',
      city: 'Cuauhtémoc',
      delegation: 'Cuauhtémoc',
      requiresPasswordChange: false,
    },
    { 
      uid: 'brigada456', 
      email: 'brigadista@partido.com', 
      role: 'brigadista',
      fullName: 'Juan Brigadista',
      state: 'Jalisco',
      city: 'Guadalajara',
      delegation: 'Centro',
      requiresPasswordChange: false,
    },
    { 
      uid: 'brigada789', 
      email: 'juan.brigadista@partido.com', 
      role: 'brigadista',
      fullName: 'Juana de Arco',
      state: 'Nuevo León',
      city: 'Monterrey',
      delegation: 'San Pedro',
      requiresPasswordChange: true, // Para pruebas
    },
];

let mockAffiliates: Affiliate[] = [
  {
    id: '1',
    createdAt: '2023-10-01T10:00:00Z',
    fullName: 'Juan Pérez García',
    email: 'juan.perez@example.com',
    phone: '5512345678',
    address: 'Calle Falsa 123',
    city: 'Ciudad de México',
    state: 'México',
    zip: '06000',
    status: 'activo',
    documentation: [
      { id: 'd1', type: 'INE', status: 'approved', fileName: 'ine_juan.pdf' },
      { id: 'd2', type: 'Comprobante de Domicilio', status: 'approved', fileName: 'domicilio_juan.pdf' },
      { id: 'd3', type: 'Estado de Cuenta', status: 'pending', fileName: 'cuenta_juan.pdf' },
    ],
    latitude: 19.4326,
    longitude: -99.1332,
  },
  {
    id: '2',
    createdAt: '2023-09-15T14:30:00Z',
    fullName: 'Maria Rodriguez Lopez',
    email: 'maria.r@example.com',
    phone: '8187654321',
    address: 'Avenida Siempre Viva 742',
    city: 'Monterrey',
    state: 'Nuevo León',
    zip: '64000',
    status: 'inactivo',
    documentation: [
      { id: 'd4', type: 'INE', status: 'approved', fileName: 'ine_maria.jpg' },
      { id: 'd5', type: 'Comprobante de Domicilio', status: 'rejected', rejectionReason: 'No coincide la dirección', fileName: 'domicilio_maria.png' },
    ],
  },
  {
    id: '3',
    createdAt: '2023-11-05T11:20:00Z',
    fullName: 'Carlos Sanchez Ruiz',
    email: 'carlos.s@example.com',
    phone: '3398765432',
    address: 'Boulevard de los Sueños Rotos 45',
    city: 'Guadalajara',
    state: 'Jalisco',
    zip: '44100',
    status: 'activo',
    documentation: [],
  },
];

let mockAuditLogs: AuditLog[] = [
    {
        id: 'log1',
        timestamp: new Date().toISOString(),
        userEmail: 'admin@example.com',
        action: 'UPDATE_AFFILIATE',
        details: 'Updated status of Juan Pérez García to activo',
    },
    {
        id: 'log2',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        userEmail: 'admin@example.com',
        action: 'CREATE_AFFILIATE',
        details: 'Created new affiliate Maria Rodriguez Lopez',
    }
];

let mockNotifications: Notification[] = [
    {
        id: 'notif1',
        type: 'pending_docs',
        message: 'Documentos de Juan Pérez G. requieren revisión.',
        timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
        read: false,
        relatedId: '1',
    },
    {
        id: 'notif2',
        type: 'new_affiliate',
        message: 'Nuevo afiliado registrado: Ana Torres.',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
        read: true,
        relatedId: 'new-id-123',
    }
];

// --- Real-time subscription simulation ---
type Listener<T> = (data: T[]) => void;
const affiliateListeners = new Set<Listener<Affiliate>>();
const auditLogListeners = new Set<Listener<AuditLog>>();
const notificationListeners = new Set<Listener<Notification>>();
const userListeners = new Set<Listener<User>>();


const notifyListeners = <T>(listeners: Set<Listener<T>>, data: T[]) => {
    listeners.forEach(listener => listener(data));
};

// Simulamos Firebase Auth y Firestore
export const firebaseService = {
    auth: {
        onAuthStateChanged: (callback: (user: User | null) => void): (() => void) => {
            setTimeout(() => {
                const userJson = sessionStorage.getItem('firebase.auth.user');
                const user = userJson ? JSON.parse(userJson) : null;
                callback(user);
            }, 100);
            return () => {};
        },
        signInWithEmailAndPassword: async (email: string, password: string): Promise<{ user: User | null; error: { message: string } | null }> => {
            await new Promise(res => setTimeout(res, 500));
            
            let foundUser: User | undefined;
            if (email.toLowerCase() === 'admin') {
                foundUser = mockUsers.find(u => u.role === 'admin' && u.email === 'admin@example.com');
            } else {
                foundUser = mockUsers.find(u => u.email === email);
            }
            
            // En una app real, la contraseña estaría hasheada. Aquí es una simulación simple.
            if (foundUser && (password === 'admin' || password === 'brigadista' || password === 'password123')) {
                const userToStore = { ...foundUser };
                sessionStorage.setItem('firebase.auth.user', JSON.stringify(userToStore));
                window.dispatchEvent(new Event('authChanged'));
                return { user: userToStore, error: null };
            }

            return { user: null, error: { message: 'Credenciales inválidas' } };
        },
        signOut: async (): Promise<void> => {
            sessionStorage.removeItem('firebase.auth.user');
            window.dispatchEvent(new Event('authChanged'));
        },
    },

    updateCurrentUserPassword: async (newPassword: string): Promise<void> => {
        await new Promise(res => setTimeout(res, 500));
        const userJson = sessionStorage.getItem('firebase.auth.user');
        if (!userJson) {
            throw new Error("No hay un usuario autenticado.");
        }
        const currentUser: User = JSON.parse(userJson);

        const userInDb = mockUsers.find(u => u.uid === currentUser.uid);
        if (!userInDb) {
            throw new Error("El usuario no se encontró en la base de datos.");
        }

        // Simular el cambio de contraseña (no almacenamos contraseñas en texto plano)
        console.log(`Contraseña para ${userInDb.email} cambiada a "${newPassword}" (simulado).`);
        
        userInDb.requiresPasswordChange = false;

        const newLog: AuditLog = {
            id: generateId(),
            timestamp: new Date().toISOString(),
            userEmail: currentUser.email!,
            action: 'PASSWORD_CHANGE',
            details: 'El usuario actualizó su contraseña.'
        };
        mockAuditLogs.unshift(newLog);
        notifyListeners(auditLogListeners, mockAuditLogs);
        
        // Actualizar la sesión
        const updatedUserSession = { ...currentUser, requiresPasswordChange: false };
        sessionStorage.setItem('firebase.auth.user', JSON.stringify(updatedUserSession));

        notifyListeners(userListeners, mockUsers);
    },


    getDashboardMetrics: async (): Promise<DashboardMetrics> => {
        await new Promise(res => setTimeout(res, 500));
        return {
            totalAffiliates: mockAffiliates.length + 1247, // a base number
            activePercentage: 88,
            docsCompletePercentage: 75,
            monthlyGrowth: [
                { month: 'Ene', count: 50 }, { month: 'Feb', count: 75 }, { month: 'Mar', count: 120 },
                { month: 'Abr', count: 90 }, { month: 'May', count: 150 }, { month: 'Jun', count: 110 },
            ],
            geoDistribution: [
                { state: 'Jalisco', count: 300 }, { state: 'México', count: 250 },
                { state: 'Nuevo León', count: 200 }, { state: 'Puebla', count: 150 },
                { state: 'Otros', count: 350 },
            ],
            recentAffiliates: [...mockAffiliates].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5),
        };
    },

    onAffiliatesSnapshot: (callback: Listener<Affiliate>): (() => void) => {
        affiliateListeners.add(callback);
        callback([...mockAffiliates]);
        return () => affiliateListeners.delete(callback);
    },
    
    onAuditLogsSnapshot: (callback: Listener<AuditLog>): (() => void) => {
        auditLogListeners.add(callback);
        callback([...mockAuditLogs]);
        return () => auditLogListeners.delete(callback);
    },

    onNotificationsSnapshot: (callback: Listener<Notification>): (() => void) => {
        notificationListeners.add(callback);
        callback([...mockNotifications]);
        return () => notificationListeners.delete(callback);
    },

    onUsersSnapshot: (callback: Listener<User>): (() => void) => {
        userListeners.add(callback);
        callback([...mockUsers]);
        return () => userListeners.delete(callback);
    },

    markAllNotificationsAsRead: async (): Promise<void> => {
        await new Promise(res => setTimeout(res, 200));
        mockNotifications.forEach(n => n.read = true);
        notifyListeners(notificationListeners, mockNotifications);
    },

    saveAffiliate: async (affiliate: Partial<Affiliate>, user: User): Promise<Affiliate> => {
        await new Promise(res => setTimeout(res, 500));
        const userEmail = user.email || 'unknown';
        
        const newLog: AuditLog = {
            id: generateId(),
            timestamp: new Date().toISOString(),
            userEmail: userEmail,
            action: affiliate.id ? 'UPDATE_AFFILIATE' : 'CREATE_AFFILIATE',
            details: `Affiliate ${affiliate.fullName} was ${affiliate.id ? 'updated' : 'created'}`
        };
        mockAuditLogs.unshift(newLog);
        notifyListeners(auditLogListeners, mockAuditLogs);

        if (affiliate.id) {
            const index = mockAffiliates.findIndex(a => a.id === affiliate.id);
            if (index !== -1) {
                mockAffiliates[index] = { ...mockAffiliates[index], ...affiliate } as Affiliate;
                notifyListeners(affiliateListeners, mockAffiliates);
                return mockAffiliates[index];
            }
        }
        
        const newDocumentation: Document[] = (affiliate.documentation || []).map(doc => ({
            id: generateId(),
            type: doc.type,
            status: 'pending',
            fileName: doc.fileName || 'N/A',
        }));

        const newAffiliate: Affiliate = {
            id: generateId(),
            createdAt: new Date().toISOString(),
            fullName: affiliate.fullName || '',
            email: affiliate.email || '',
            phone: affiliate.phone || '',
            address: affiliate.address || '',
            city: affiliate.city || '',
            state: affiliate.state || '',
            zip: affiliate.zip || '',
            status: affiliate.status || 'inactivo',
            documentation: newDocumentation,
            latitude: affiliate.latitude,
            longitude: affiliate.longitude,
        };
        mockAffiliates.unshift(newAffiliate);
        notifyListeners(affiliateListeners, mockAffiliates);
        return newAffiliate;
    },

    registerAffiliate: async (
      affiliateData: Omit<Affiliate, 'id' | 'createdAt' | 'documentation' | 'status'>,
      documents: {type: Document['type'], fileName: string}[],
      geolocation?: {latitude: number, longitude: number}
    ): Promise<Affiliate> => {
        await new Promise(res => setTimeout(res, 500));

        const newDocuments: Document[] = documents.map(doc => ({
            id: generateId(),
            type: doc.type,
            status: 'pending',
            fileName: doc.fileName,
        }));

        const newAffiliate: Affiliate = {
            id: generateId(),
            createdAt: new Date().toISOString(),
            ...affiliateData,
            status: 'inactivo',
            documentation: newDocuments,
            ...geolocation
        };

        const newLog: AuditLog = {
            id: generateId(),
            timestamp: new Date().toISOString(),
            userEmail: newAffiliate.email,
            action: 'SELF_REGISTER',
            details: `New affiliate ${newAffiliate.fullName} registered.`
        };

        const newNotification: Notification = {
            id: generateId(),
            type: 'new_affiliate',
            message: `Nuevo afiliado registrado: ${newAffiliate.fullName}`,
            timestamp: new Date().toISOString(),
            read: false,
            relatedId: newAffiliate.id,
        };

        mockAffiliates.unshift(newAffiliate);
        mockAuditLogs.unshift(newLog);
        mockNotifications.unshift(newNotification);
        
        notifyListeners(affiliateListeners, mockAffiliates);
        notifyListeners(auditLogListeners, mockAuditLogs);
        notifyListeners(notificationListeners, mockNotifications);

        return newAffiliate;
    },

    saveUser: async (userData: Partial<User> & { password?: string }, adminUser: User): Promise<User> => {
        await new Promise(res => setTimeout(res, 500));

        if (!userData.email || !userData.role || !userData.fullName) {
            throw new Error("El nombre, correo y el rol son requeridos.");
        }

        const newLog: AuditLog = {
            id: generateId(),
            timestamp: new Date().toISOString(),
            userEmail: adminUser.email!,
            action: userData.uid ? 'UPDATE_USER' : 'CREATE_USER',
            details: `User ${userData.email} was ${userData.uid ? 'updated' : 'created'}.`
        };
        mockAuditLogs.unshift(newLog);
        notifyListeners(auditLogListeners, mockAuditLogs);

        if (userData.uid) { // Update
            const index = mockUsers.findIndex(u => u.uid === userData.uid);
            if (index !== -1) {
                mockUsers[index] = { ...mockUsers[index], ...userData };
                notifyListeners(userListeners, mockUsers);
                return mockUsers[index];
            }
            throw new Error("Usuario no encontrado.");
        } else { // Create
            if (mockUsers.some(u => u.email === userData.email)) {
                throw new Error("El correo electrónico ya está en uso.");
            }
            const newUser: User = {
                uid: generateId(),
                email: userData.email,
                role: userData.role,
                fullName: userData.fullName,
                state: userData.state,
                city: userData.city,
                delegation: userData.delegation,
                requiresPasswordChange: true, // Forzar cambio en primer login
            };
            mockUsers.push(newUser);
            notifyListeners(userListeners, mockUsers);
            return newUser;
        }
    },

    deleteUser: async (userId: string, adminUser: User): Promise<void> => {
        await new Promise(res => setTimeout(res, 500));

        if (userId === adminUser.uid) {
            throw new Error("No puedes eliminar tu propia cuenta.");
        }

        const userToDelete = mockUsers.find(u => u.uid === userId);
        if (!userToDelete) {
            throw new Error("Usuario no encontrado.");
        }
        
        const newLog: AuditLog = {
            id: generateId(),
            timestamp: new Date().toISOString(),
            userEmail: adminUser.email!,
            action: 'DELETE_USER',
            details: `User ${userToDelete.email} was deleted.`
        };
        mockAuditLogs.unshift(newLog);
        notifyListeners(auditLogListeners, mockAuditLogs);
        
        mockUsers = mockUsers.filter(u => u.uid !== userId);
        notifyListeners(userListeners, mockUsers);
    }
};