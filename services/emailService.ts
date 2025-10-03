// Servicio para envío de emails
// TODO: Implementar con un proveedor real como SendGrid, Mailgun, etc.

interface WelcomeEmailData {
  to: string;
  fullName: string;
  affiliateId?: string;
}

interface EmailService {
  sendWelcomeEmail: (data: WelcomeEmailData) => Promise<boolean>;
}

class EmailServiceImpl implements EmailService {
  private apiKey?: string;
  private baseUrl?: string;

  constructor() {
    // En Vite, usar import.meta.env en lugar de process.env
    this.apiKey = import.meta.env.VITE_EMAIL_API_KEY;
    this.baseUrl = import.meta.env.VITE_EMAIL_API_URL;
  }

  async sendWelcomeEmail(data: WelcomeEmailData): Promise<boolean> {
    try {
      console.log(`📧 Enviando email de bienvenida a ${data.to} para ${data.fullName}`);

      // Email HTML template
      const emailHtml = this.generateWelcomeEmailHtml(data);

      // En desarrollo, solo simulamos el envío
      if (!this.apiKey || !this.baseUrl) {
        console.log('📧 [SIMULADO] Email enviado exitosamente:', {
          to: data.to,
          subject: '¡Bienvenido a Movimiento Ciudadano!',
          html: emailHtml.substring(0, 100) + '...'
        });
        return true;
      }

      // TODO: Implementar llamada real a API de email
      // const response = await fetch(`${this.baseUrl}/send`, {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //     'Authorization': `Bearer ${this.apiKey}`
      //   },
      //   body: JSON.stringify({
      //     to: data.to,
      //     subject: '¡Bienvenido a Movimiento Ciudadano!',
      //     html: emailHtml,
      //     from: 'noreply@movimientociudadano.mx'
      //   })
      // });

      // if (!response.ok) {
      //   throw new Error(`Error en API de email: ${response.statusText}`);
      // }

      console.log('✅ Email enviado exitosamente');
      return true;

    } catch (error) {
      console.error('❌ Error enviando email:', error);
      return false;
    }
  }

  private generateWelcomeEmailHtml(data: WelcomeEmailData): string {
    return `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>¡Bienvenido a Movimiento Ciudadano!</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #FF6B35, #F7931E); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: white; padding: 30px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #FF6B35; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>¡Bienvenido a Movimiento Ciudadano!</h1>
          </div>
          <div class="content">
            <h2>¡Hola ${data.fullName}!</h2>

            <p>¡Gracias por unirte a <strong>Movimiento Ciudadano</strong>! Tu afiliación ha sido registrada exitosamente.</p>

            <p>Ahora formas parte de un movimiento que lucha por un México mejor, más justo y más próspero.</p>

            <h3>¿Qué sigue?</h3>
            <ul>
              <li><strong>Acceso a la App:</strong> Has recibido credenciales para acceder a nuestra plataforma digital</li>
              <li><strong>Información:</strong> Recibirás actualizaciones sobre actividades y eventos en tu zona</li>
              <li><strong>Participación:</strong> Podrás involucrarte en las decisiones y acciones del partido</li>
            </ul>

            <p>Para activar tu cuenta, por favor inicia sesión en la aplicación con el correo electrónico que proporcionaste durante tu registro.</p>

            <p><strong>¿Necesitas ayuda?</strong><br>
            Contáctanos en: contacto@movimientociudadano.mx<br>
            Teléfono: (55) 1234-5678</p>

            <p>¡Juntos construiremos el México que todos queremos!</p>

            <p style="text-align: center;">
              <a href="#" class="button">Acceder a la App</a>
            </p>

            <div class="footer">
              <p>Este es un mensaje automático, por favor no respondas a este correo.</p>
              <p>Movimiento Ciudadano © ${new Date().getFullYear()}</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}

export const emailService = new EmailServiceImpl();
