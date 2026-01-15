"use client"

import { ScrollText } from 'lucide-react'

interface TermsOfServiceModalProps {
  isOpen: boolean
  onAccept: () => void
}

export function TermsOfServiceModal({ isOpen, onAccept }: TermsOfServiceModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative bg-[#141414] border border-[#262626] rounded-xl w-full max-w-[500px] max-h-[600px] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-[#262626]">
          <div className="w-10 h-10 rounded-lg bg-[#262626] flex items-center justify-center">
            <ScrollText className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Terms of Service</h2>
            <p className="text-sm text-[#737373]">Please read and accept to continue</p>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 text-sm text-[#b5b5b5] space-y-4 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-[#0A0A0A] [&::-webkit-scrollbar-thumb]:bg-[#404040] [&::-webkit-scrollbar-thumb]:rounded-full">
          <section>
            <h3 className="text-white font-medium mb-2">1. Acceptance of Terms</h3>
            <p>
              By accessing and using dappTerminal (&ldquo;the Application&rdquo;), you acknowledge that you have read,
              understood, and agree to be bound by these Terms of Service. If you do not agree to these
              terms, please do not use the Application.
            </p>
          </section>

          <section>
            <h3 className="text-white font-medium mb-2">2. Experimental Software</h3>
            <p>
              dappTerminal is experimental software currently in alpha development. The Application is
              provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without any warranties of any kind, either express or
              implied. You acknowledge that the software may contain bugs, errors, and other issues that
              could cause system failures or data loss.
            </p>
          </section>

          <section>
            <h3 className="text-white font-medium mb-2">3. DeFi Risk Acknowledgment</h3>
            <p>
              You understand that interacting with decentralized finance (DeFi) protocols involves
              significant risks, including but not limited to:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-[#9a9a9a]">
              <li>Smart contract vulnerabilities and exploits</li>
              <li>Impermanent loss and market volatility</li>
              <li>Loss of funds due to user error</li>
              <li>Protocol failures or rug pulls</li>
              <li>Regulatory and legal risks</li>
            </ul>
          </section>

          <section>
            <h3 className="text-white font-medium mb-2">4. No Financial Advice</h3>
            <p>
              Nothing in this Application constitutes financial, investment, legal, or tax advice.
              You are solely responsible for evaluating the risks and merits of any transaction.
              Always do your own research before interacting with any DeFi protocol.
            </p>
          </section>

          <section>
            <h3 className="text-white font-medium mb-2">5. User Responsibility</h3>
            <p>
              You are solely responsible for:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-[#9a9a9a]">
              <li>Securing your wallet and private keys</li>
              <li>Verifying transaction details before signing</li>
              <li>Understanding the protocols you interact with</li>
              <li>Complying with applicable laws in your jurisdiction</li>
            </ul>
          </section>

          <section>
            <h3 className="text-white font-medium mb-2">6. Limitation of Liability</h3>
            <p>
              To the maximum extent permitted by law, the developers and contributors of dappTerminal
              shall not be liable for any direct, indirect, incidental, special, consequential, or
              punitive damages, including but not limited to loss of profits, data, or cryptocurrency,
              arising from your use of the Application.
            </p>
          </section>

          <section>
            <h3 className="text-white font-medium mb-2">7. Modifications</h3>
            <p>
              We reserve the right to modify these Terms of Service at any time. Continued use of the
              Application after any changes constitutes acceptance of the new terms.
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#262626] bg-[#0f0f0f] rounded-b-xl">
          <button
            onClick={onAccept}
            className="w-full py-3 bg-white text-black font-semibold rounded-lg hover:bg-gray-200 transition-colors"
          >
            I Agree to the Terms of Service
          </button>
          <p className="text-xs text-[#5a5a5a] text-center mt-3">
            By clicking &ldquo;I Agree&rdquo;, you confirm that you have read and accept these terms.
          </p>
        </div>
      </div>
    </div>
  )
}
