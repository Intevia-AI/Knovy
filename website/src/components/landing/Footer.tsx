import { useState } from 'react';
import { Mail, Instagram, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import inteviaLogo from '@/assets/intevia_logo.svg';
import inteviaLogoWhite from '@/assets/intevia_logo_white.svg';
const termsContent = `Terms of Service
Last Updated: October 1, 2026

1. Acceptance of Terms
Welcome to Knovy (hereinafter referred to as "the Service"). These Terms of Service (hereinafter referred to as "the Terms") constitute a legally binding agreement between you and us. By using the Service or accessing our website, you agree to be bound by these Terms.

2. Service Description
The Service provides real-time screen and audio analysis tools, including:
• Real-time transcription of system and microphone audio.
• AI-powered screen content analysis and interaction.
• Secure storage of your session history and transcripts.
• AI-powered insights and response suggestions.

3. User Obligations and Conduct
The current desktop application does not require registration or a Knovy account. You agree to:
• Use the application and website in accordance with applicable laws.
• Obtain any permissions or consent required to capture or process other people's audio, screens, or content.
• Be responsible for the content you process and for your local data, exports, and backups.
• Use care when sharing content with third-party services or contacting support.

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
We may modify or discontinue website availability or future software releases. You may stop using the application and website at any time. The current desktop application has no Knovy account to terminate; locally stored data remains under your control.

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
Last Updated: October 1, 2026

1. Scope
This policy describes the current Knovy local desktop application, the Knovy marketing website, and historical waitlist records managed by INTEVIA AI.

2. Desktop Processing and Local Storage
The current desktop application does not require a Knovy account or cloud API keys. Microphone and system audio transcription runs locally through whisper.cpp. AI requests, including text and screenshots you choose to process, are sent to the Ollama service on your computer at localhost:11434. The application does not send this processing content to a Knovy cloud backend, Supabase, or Google Gemini.
Session history, transcripts, summaries, and related metadata are stored in a local SQLite database. Settings and screenshots may also be stored locally in the application's data directory. The current desktop application does not include Knovy usage telemetry.

3. Network Requests
Local processing does not mean the application never connects to the internet. It checks for and downloads application updates from GitHub, downloads transcription models from Hugging Face, and can request model downloads through your local Ollama service. These providers receive the network information needed to handle those requests. Links you choose to open, including support forms, open third-party services in your browser.

4. Website Services and Browser Storage
The marketing website is hosted on Vercel. Hosting providers process request information, such as IP addresses, to deliver and operate the website. The website loads Google Fonts, requests release information from GitHub, and loads YouTube video thumbnails. Playing the demo loads a YouTube privacy-enhanced embedded player. Those requests disclose normal connection information to the respective providers and are subject to their privacy policies.
The website saves your light or dark theme preference in browser local storage. The current website has no Knovy account registration, active waitlist signup form, or application analytics integration. This does not imply that hosting providers or embedded third-party services perform no logging or use no browser storage.

5. Historical Waitlist and Voluntary Contact
Contact records supplied through the earlier waitlist contain an ID, email address, and creation time. They are held separately from desktop session data in a restricted Firebase Firestore database in Taiwan. Original migration copies remain in the prior private backend and private local backups while the migration is verified. They are not published in the source repository, and website visitors cannot read or write the Firestore collection.
If you contact us by email or submit an external support form, we receive the information you choose to provide. Do not include recordings, screenshots, or other sensitive content unless you intend to share it for support.

6. Your Controls
You control the desktop application's operating-system permissions and local data. You can delete sessions through the application's history interface and manage your own exports and backups. Deleting a session does not automatically erase exported files, other local files, or backups you created. You can clear the website's theme preference through your browser settings.
For questions or requests concerning historical waitlist or support information held by INTEVIA AI, contact inteviaai@gmail.com.

7. Changes and Contact
We may update this policy when the application's or website's data practices change. The date above identifies the current policy version. Contact: inteviaai@gmail.com.`;
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
