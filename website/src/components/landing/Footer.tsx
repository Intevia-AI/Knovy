import { useState } from 'react';
import { Mail, Instagram, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import inteviaLogo from '@/assets/intevia_logo.svg';
import inteviaLogoWhite from '@/assets/intevia_logo_white.svg';
const termsContent = `Terms of Service
Last Updated: September 8, 2025

1. Acceptance of Terms
Welcome to Knovy (hereinafter referred to as "the Service"). These Terms of Service (hereinafter referred to as "the Terms") constitute a legally binding agreement between you and us. By using the Service or accessing our website, you agree to be bound by these Terms.

2. Service Description
The Service provides real-time screen and audio analysis tools, including:
• Real-time transcription of system and microphone audio.
• AI-powered screen content analysis and interaction.
• Secure storage of your session history and transcripts.
• AI-powered insights and response suggestions.

3. User Obligations and Conduct
To use the Service, you must register an account. You agree to:
• Provide accurate and complete information during registration.
• Protect your account credentials and be fully responsible for all activities under your account.
• Be responsible for all content you process using the Service.
• Notify us immediately if you discover any unauthorized use of your account or security breaches.

4. Usage Restrictions
You agree not to:
• Violate any applicable laws or regulations.
• Use the Service to infringe on others' intellectual property rights.
• Attempt to disrupt, reverse engineer, or compromise the integrity of the Service.
• Use the Service for any commercial purpose without our explicit written consent.

5. Intellectual Property Rights
The Service and all related content (including software, designs, text, and images) are protected by copyright and other intellectual property laws. We grant you a limited, non-exclusive, non-transferable license to use the Service.
You retain full ownership of the content you create. By using the Service, you grant us the necessary permissions to process this content on your behalf to provide service functionality.

6. Privacy Protection
We are committed to protecting your privacy. For details on how we collect, use, and protect your personal data, please refer to our Privacy Policy.

7. Service Modifications and Termination
We reserve the right to modify, suspend, or terminate the Service at any time, with or without notice. We may also terminate your access if you violate these Terms. Upon termination, your right to use the Service will immediately cease.

8. Disclaimer
The Service is provided on an "as is" and "as available" basis without any express or implied warranties. We do not guarantee the accuracy, reliability, or suitability of the Service. Your use of the Service is at your own risk.

9. Limitation of Liability
To the maximum extent permitted by law, we shall not be liable for any direct, indirect, incidental, or consequential damages arising from your use or inability to use the Service.

10. Governing Law
These Terms and Conditions are governed by and interpreted in accordance with the laws of the Republic of China (Taiwan). You irrevocably agree that the Taipei District Court of Taiwan shall have exclusive jurisdiction as the court of first instance.

11. Changes to Terms
We may update these Terms from time to time. If there are significant changes, we will notify you. Your continued use of the Service after changes constitutes acceptance of the revised Terms.

12. Contact Information
If you have any questions about these Terms of Service, please contact us at: inteviaai@gmail.com`;

const privacyContent = `Privacy Policy
Last Updated: September 8, 2025

1. Privacy Policy Overview
We value your privacy. This Privacy Policy explains how we collect, use, store, and protect your personal data when you use the Knovy application. By using our services, you agree to the practices described in this Privacy Policy.

2. Data We Collect

2.1. Data You Provide
Account Information: When you register, we collect your email address and name.
User Settings: We store your preferences such as language and interface settings.
This information is securely stored on our servers and is necessary to provide and personalize services.

2.2. Automatically Collected Data
We may collect anonymous usage data to improve our services, such as feature usage frequency and performance metrics.

2.3. Data Processed for You
When you use the Service, we process screen and audio content to provide real-time analysis. This content is sent to our secure backend and Google Gemini API for processing. We may store transcripts and session metadata associated with your account to provide your session history.

3. Purpose of Data Use
We use your data for the following purposes:
• Provide, maintain, and improve our services.
• Provide your session history, including transcripts and summaries.
• Generate AI summaries and insights through Google Gemini API.
• Personalize your experience based on your settings.
• Provide customer support and troubleshooting.
• Conduct security monitoring and fraud prevention.

4. Data Sharing and Disclosure
We commit not to sell your personal data. We only share your data in the following circumstances:
• Sharing with third-party services: We send processed content to Google's generative AI services to provide analysis. Google's use of your data is governed by their respective privacy policies.
• Legal compliance: If required by law or court order.
• Protecting our rights: To protect our and users' rights, property, or safety.

5. Data Security
We employ industry-standard security measures to protect your data. All communications with our servers are encrypted. However, no electronic storage method is 100% secure, and we cannot guarantee absolute security.

6. Your Rights
You have full control over your data:
• Access and Correction Rights: You can access and update your account information directly within the application.
• Deletion Rights: You can manage and delete your session history within the application. To delete your entire account, please contact us.

7. Cookie Usage
Our website does not use cookies for tracking. The application uses secure tokens for authentication.

8. Third-Party Services
Our service relies on integration with Supabase for authentication and Google Gemini for AI functionality. These third parties have their own privacy policies, and we are not responsible for their privacy practices. We recommend reviewing their policies.

9. Policy Changes
We may update this Privacy Policy from time to time. If there are significant changes, we will notify you through in-app notifications or on our website. We recommend reviewing this policy periodically.

10. Contact Us
If you have any questions about this Privacy Policy, please contact us at: inteviaai@gmail.com`;
export function Footer() {
  return <footer id="contact" className="py-16 px-4 border-t border-border">
      <div className="container mx-auto max-w-6xl">
        <div className="grid md:grid-cols-3 gap-12 mb-12">
          {/* Brand */}
          <div>
            <a href="#" className="flex items-center gap-2 mb-4">
              <img src={inteviaLogo} alt="Intevia AI" className="h-8 w-auto dark:hidden" />
              <img src={inteviaLogoWhite} alt="Intevia AI" className="hidden h-8 w-auto dark:block" />
              
            </a>
            <p className="text-sm text-muted-foreground">
              Knovy
            </p>
          </div>

          {/* Contact */}
          <div>
            <h3 className="font-semibold mb-4 text-base">Contact</h3>
            <div className="space-y-3">
              <a href="mailto:inteviaai@gmail.com" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <Mail className="h-4 w-4" />
                inteviaai@gmail.com
              </a>
              <a href="https://www.instagram.com/intevia_ai_knovy/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <Instagram className="h-4 w-4" />
                @intevia_ai_knovy
              </a>
            </div>
          </div>

          {/* Legal */}
          <div>
            <h3 className="font-semibold mb-4 text-base">Legal</h3>
            <div className="space-y-3">
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="link" className="p-0 h-auto text-sm text-muted-foreground hover:text-foreground">
                    Terms of Service
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[80vh]">
                  <DialogHeader>
                    <DialogTitle>Terms of Service</DialogTitle>
                  </DialogHeader>
                  <ScrollArea className="h-[60vh] pr-4">
                    <div className="whitespace-pre-wrap text-sm text-muted-foreground">
                      {termsContent}
                    </div>
                  </ScrollArea>
                </DialogContent>
              </Dialog>

              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="link" className="p-0 h-auto text-sm text-muted-foreground hover:text-foreground block">
                    Privacy Policy
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[80vh]">
                  <DialogHeader>
                    <DialogTitle>Privacy Policy</DialogTitle>
                  </DialogHeader>
                  <ScrollArea className="h-[60vh] pr-4">
                    <div className="whitespace-pre-wrap text-sm text-muted-foreground">
                      {privacyContent}
                    </div>
                  </ScrollArea>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div className="pt-8 border-t border-border flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4" />
            Taipei, Taiwan
          </div>
          <p className="text-sm text-muted-foreground">
            © 2025 INTEVIA AI All Rights Reserved
          </p>
        </div>
      </div>
    </footer>;
}
