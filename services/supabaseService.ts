// FIX: Implemented a mock Supabase service to make the file a module and provide necessary functions.
import type { Affiliate, DashboardMetrics, AuditLog, User, Document } from '../types';

const generateId = () => Math.random().toString(36).substring(2, 9);

const mockAffiliates: Affiliate[] = [
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

const mockAuditLogs: AuditLog[] = [
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

// In a real app, this would be a Supabase client. Here we mock it.
export const supabase = {
    auth: {
        user: async (): Promise<User | null> => {
            // Check session storage for a mock user
            const userJson = sessionStorage.getItem('supabase.auth.user');
            return userJson ? JSON.parse(userJson) : null;
        },
        signIn: async ({ email, password }: {email: string, password: string}): Promise<{ user: User | null; error: { message: string } | null }> => {
            await new Promise(res => setTimeout(res, 500));
            if (email === 'admin' && password === 'admin') {
                // FIX: Corrected the user object to match the `User` interface. Changed `id` to `uid` and removed extraneous properties.
                const user: User = {
                    uid: 'user123',
                    email: 'admin@example.com',
                    role: 'admin',
                };
                sessionStorage.setItem('supabase.auth.user', JSON.stringify(user));
                return { user, error: null };
            }
            return { user: null, error: { message: 'Invalid credentials' } };
        },
        signOut: async (): Promise<{ error: null }> => {
            sessionStorage.removeItem('supabase.auth.user');
            return { error: null };
        },
    },

    getDashboardMetrics: async (): Promise<DashboardMetrics> => {
        await new Promise(res => setTimeout(res, 500));
        return {
            totalAffiliates: 1250,
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
            recentAffiliates: mockAffiliates.slice(0, 5),
        };
    },
    getAffiliates: async (): Promise<Affiliate[]> => {
        await new Promise(res => setTimeout(res, 500));
        return [...mockAffiliates];
    },
    getAuditLogs: async (): Promise<AuditLog[]> => {
        await new Promise(res => setTimeout(res, 500));
        return [...mockAuditLogs];
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

        if (affiliate.id) {
            const index = mockAffiliates.findIndex(a => a.id === affiliate.id);
            if (index !== -1) {
                mockAffiliates[index] = { ...mockAffiliates[index], ...affiliate } as Affiliate;
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
        };
        mockAffiliates.unshift(newAffiliate);
        return newAffiliate;
    },
    registerAffiliate: async (affiliateData: Omit<Affiliate, 'id' | 'createdAt' | 'documentation' | 'status'>, documents: {type: Document['type'], fileName: string}[]): Promise<Affiliate> => {
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
            fullName: affiliateData.fullName || '',
            email: affiliateData.email || '',
            phone: affiliateData.phone || '',
            address: affiliateData.address || '',
            city: affiliateData.city || '',
            state: affiliateData.state || '',
            zip: affiliateData.zip || '',
            status: 'inactivo', // New registrations are inactive until approved
            documentation: newDocuments,
        };

        const newLog: AuditLog = {
            id: generateId(),
            timestamp: new Date().toISOString(),
            userEmail: newAffiliate.email, // Use affiliate's email
            action: 'SELF_REGISTER',
            details: `New affiliate ${newAffiliate.fullName} registered.`
        };

        mockAffiliates.unshift(newAffiliate);
        mockAuditLogs.unshift(newLog);

        return newAffiliate;
    }
};