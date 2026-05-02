const { Resend } = require('resend');

exports.handler = async (event) => {
    // Only allow POST
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'RESEND_API_KEY not configured on server.' }),
        };
    }

    try {
        const {
            to_email,
            customer_name,
            invoice_number,
            invoice_date,
            due_date,
            total_amount,
            invoice_url,
            business_name,
            status,
        } = JSON.parse(event.body);

        if (!to_email) {
            return { statusCode: 400, body: JSON.stringify({ error: 'to_email is required' }) };
        }

        const resend = new Resend(apiKey);

        const statusColor = status === 'PAID' ? '#22c55e' : status === 'OVERDUE' ? '#ef4444' : '#f97316';

        const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
    <div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <!-- Header -->
        <div style="background:linear-gradient(135deg,#2563eb,#1d4ed8);padding:32px 28px;">
            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">${business_name || 'BILLJI'}</h1>
            <p style="margin:6px 0 0;color:#93c5fd;font-size:13px;">Invoice Notification</p>
        </div>

        <!-- Body -->
        <div style="padding:28px;">
            <p style="margin:0 0 20px;color:#334155;font-size:15px;line-height:1.6;">
                Hi <strong>${customer_name || 'Customer'}</strong>,
            </p>
            <p style="margin:0 0 24px;color:#475569;font-size:14px;line-height:1.6;">
                Here is your invoice from <strong>${business_name || 'BILLJI'}</strong>. Please find the details below:
            </p>

            <!-- Invoice Details Card -->
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin-bottom:24px;">
                <table style="width:100%;border-collapse:collapse;">
                    <tr>
                        <td style="padding:6px 0;color:#64748b;font-size:13px;">Invoice #</td>
                        <td style="padding:6px 0;color:#1e293b;font-size:13px;font-weight:600;text-align:right;">${invoice_number}</td>
                    </tr>
                    <tr>
                        <td style="padding:6px 0;color:#64748b;font-size:13px;">Date</td>
                        <td style="padding:6px 0;color:#1e293b;font-size:13px;text-align:right;">${invoice_date}</td>
                    </tr>
                    <tr>
                        <td style="padding:6px 0;color:#64748b;font-size:13px;">Due Date</td>
                        <td style="padding:6px 0;color:#1e293b;font-size:13px;text-align:right;">${due_date}</td>
                    </tr>
                    <tr>
                        <td style="padding:6px 0;color:#64748b;font-size:13px;">Status</td>
                        <td style="padding:6px 0;text-align:right;">
                            <span style="background:${statusColor}22;color:${statusColor};padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;">${status}</span>
                        </td>
                    </tr>
                    <tr>
                        <td colspan="2" style="padding:12px 0 0;border-top:1px solid #e2e8f0;"></td>
                    </tr>
                    <tr>
                        <td style="padding:4px 0;color:#1e293b;font-size:16px;font-weight:700;">Total</td>
                        <td style="padding:4px 0;color:#2563eb;font-size:16px;font-weight:700;text-align:right;">${total_amount}</td>
                    </tr>
                </table>
            </div>

            <!-- CTA Button -->
            <div style="text-align:center;margin-bottom:24px;">
                <a href="${invoice_url}" style="display:inline-block;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#ffffff;padding:14px 36px;border-radius:12px;text-decoration:none;font-size:14px;font-weight:600;box-shadow:0 4px 12px rgba(37,99,235,0.3);">
                    View Invoice
                </a>
            </div>

            <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;line-height:1.6;">
                You can view and download your invoice anytime using the link above.
            </p>
        </div>

        <!-- Footer -->
        <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 28px;text-align:center;">
            <p style="margin:0 0 4px;color:#94a3b8;font-size:11px;font-style:italic;">Thank you for your business!</p>
            <p style="margin:0 0 2px;color:#94a3b8;font-size:10px;font-weight:600;">Maintained By PANDA STUDIOS</p>
            <p style="margin:0;color:#cbd5e1;font-size:10px;">A Product Of Sudeepta Kumar Panda</p>
        </div>
    </div>
</body>
</html>`;

        const { data, error } = await resend.emails.send({
            from: `${business_name || 'BILLJI'} <onboarding@resend.dev>`,
            to: [to_email],
            subject: `Invoice ${invoice_number} from ${business_name || 'BILLJI'} — ${total_amount}`,
            html: htmlContent,
        });

        if (error) {
            console.error('Resend error:', error);
            return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, id: data.id }),
        };
    } catch (err) {
        console.error('Function error:', err);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: err.message || 'Internal server error' }),
        };
    }
};
