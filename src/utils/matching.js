import { AGENTS } from '../data/agents';
import { computeChemistryScore } from './scoring';

// Given a list of selected agent IDs and required roles,
// return the best pairs with chemistry scores
export function findBestPairs(selectedIds) {
    const selected = AGENTS.filter(a => selectedIds.includes(a.id));
    const pairs = [];

    for (let i = 0; i < selected.length; i++) {
        for (let j = i + 1; j < selected.length; j++) {
            // Prefer cross-gender pairings (Generator + Evaluator, etc.)
            const crossGender = selected[i].gender !== selected[j].gender;
            const chemistry = computeChemistryScore(selected[i], selected[j]);
            pairs.push({
                agentA: selected[i],
                agentB: selected[j],
                chemistry,
                crossGender,
            });
        }
    }

    // Sort by: cross-gender first, then chemistry descending
    pairs.sort((a, b) => {
        if (a.crossGender !== b.crossGender) return b.crossGender - a.crossGender;
        return b.chemistry - a.chemistry;
    });

    return pairs;
}

// Auto-detect required roles from a project description (mock)
export function detectRoles(description) {
    const lower = description.toLowerCase();
    const roles = [];

    if (lower.match(/smart contract|solidity|defi|token|nft|blockchain|web3/))
        roles.push({ role: 'Smart Contract Generator', gender: 'Generator' });
    if (lower.match(/frontend|ui|ux|design|landing|website|app/))
        roles.push({ role: 'UI Generator', gender: 'Generator' });
    if (lower.match(/api|backend|server|database|endpoint/))
        roles.push({ role: 'Backend Generator', gender: 'Generator' });
    if (lower.match(/document|docs|readme|guide/))
        roles.push({ role: 'Documentation Generator', gender: 'Generator' });
    if (lower.match(/audit|security|vulnerability|exploit/))
        roles.push({ role: 'Security Evaluator', gender: 'Evaluator' });
    if (lower.match(/test|qa|quality|bug|coverage/))
        roles.push({ role: 'QA Evaluator', gender: 'Evaluator' });
    if (lower.match(/lint|format|style|clean/))
        roles.push({ role: 'Code Quality Evaluator', gender: 'Evaluator' });
    if (lower.match(/review|feedback|pr/))
        roles.push({ role: 'Peer Review Evaluator', gender: 'Evaluator' });
    if (lower.match(/crawl|scrape|web|index/))
        roles.push({ role: 'Web Navigator', gender: 'Navigator' });
    if (lower.match(/api|integration|connect|webhook/))
        roles.push({ role: 'API Navigator', gender: 'Navigator' });
    if (lower.match(/data|analytics|mining|sql|csv/))
        roles.push({ role: 'Data Navigator', gender: 'Navigator' });
    if (lower.match(/chain|oracle|on-chain|blockchain|solana/))
        roles.push({ role: 'Chain Navigator', gender: 'Navigator' });

    // If nothing detected, return defaults
    if (roles.length === 0) {
        roles.push(
            { role: 'Backend Generator', gender: 'Generator' },
            { role: 'QA Evaluator', gender: 'Evaluator' },
        );
    }

    // Deduplicate
    const seen = new Set();
    return roles.filter(r => {
        if (seen.has(r.role)) return false;
        seen.add(r.role);
        return true;
    });
}
