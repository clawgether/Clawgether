import { useState } from 'react';
import { TOKEN } from '../data/tokenConfig';

export default function Footer() {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(TOKEN.ca);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <footer className="site-footer">
            <div className="footer-container">
                <div className="footer-section">
                    <div className="footer-ca-box" onClick={handleCopy}>
                        <span className="ca-label">CA:</span>
                        <span className="ca-value">{TOKEN.ca}</span>
                        <button className="copy-btn">{copied ? '✅' : '📋'}</button>
                    </div>
                </div>

                <div className="footer-section footer-links">
                    <a href="https://twitter.com/Clawgether" target="_blank" rel="noopener noreferrer" className="footer-link">
                        Twitter
                    </a>
                    <span className="footer-divider">•</span>
                    <a href="https://bags.fm/Clawgether" target="_blank" rel="noopener noreferrer" className="footer-link">
                        bags.fm
                    </a>
                    <span className="footer-divider">•</span>
                    <a href="/guide" className="footer-link">
                        System Guide
                    </a>
                </div>

                <div className="footer-section footer-copyright">
                    © {new Date().getFullYear()} Clawgether. Built for the Moltbook ecosystem.
                </div>
            </div>
        </footer>
    );
}
