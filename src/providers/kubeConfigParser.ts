export interface ParsedContext {
    name: string;
    context: {
        cluster?: string;
        user?: string;
        namespace?: string;
    };
}

export interface ParsedCluster {
    name: string;
    cluster: {
        server?: string;
    };
}

export interface ParsedKubeConfig {
    'current-context'?: string;
    contexts?: ParsedContext[];
    clusters?: ParsedCluster[];
}

/**
 * Robust zero-dependency parser for Kubernetes kubeconfig YAML files.
 * Ensures the extension activates with 0 external runtime dependencies.
 */
export function parseKubeConfigYaml(content: string): ParsedKubeConfig {
    const result: ParsedKubeConfig = {
        contexts: [],
        clusters: []
    };

    if (!content || !content.trim()) {
        return result;
    }

    const lines = content.split(/\r?\n/);
    let section: 'contexts' | 'clusters' | 'other' | null = null;
    let currentItem: any = null;
    let inSubBlock: string | null = null;

    for (let i = 0; i < lines.length; i++) {
        const rawLine = lines[i];
        const trimmed = rawLine.trim();

        if (!trimmed || trimmed.startsWith('#')) {
            continue;
        }

        // Top level keys (no leading spaces)
        const topLevelMatch = rawLine.match(/^([a-zA-Z0-9_-]+)\s*:\s*(.*)$/);
        if (topLevelMatch && !rawLine.startsWith(' ') && !rawLine.startsWith('\t')) {
            const key = topLevelMatch[1];
            const value = topLevelMatch[2].trim().replace(/^['"]|['"]$/g, '');

            if (key === 'current-context') {
                result['current-context'] = value;
                section = null;
                currentItem = null;
                continue;
            } else if (key === 'contexts') {
                section = 'contexts';
                currentItem = null;
                continue;
            } else if (key === 'clusters') {
                section = 'clusters';
                currentItem = null;
                continue;
            } else {
                section = 'other';
                currentItem = null;
                continue;
            }
        }

        if (section === 'contexts') {
            const itemStartMatch = rawLine.match(/^\s*-\s+(.*)$/);
            if (itemStartMatch) {
                currentItem = { name: '', context: {} };
                result.contexts!.push(currentItem);
                inSubBlock = null;

                const rest = itemStartMatch[1].trim();
                const restKv = rest.match(/^([a-zA-Z0-9_-]+)\s*:\s*(.*)$/);
                if (restKv) {
                    const k = restKv[1];
                    const v = restKv[2].trim().replace(/^['"]|['"]$/g, '');
                    if (k === 'name') {
                        currentItem.name = v;
                    } else if (k === 'context') {
                        inSubBlock = 'context';
                    }
                }
                continue;
            }

            if (currentItem) {
                const kvMatch = rawLine.match(/^\s+([a-zA-Z0-9_-]+)\s*:\s*(.*)$/);
                if (kvMatch) {
                    const k = kvMatch[1];
                    const v = kvMatch[2].trim().replace(/^['"]|['"]$/g, '');
                    if (k === 'context') {
                        inSubBlock = 'context';
                    } else if (k === 'name' && !inSubBlock) {
                        currentItem.name = v;
                    } else if (inSubBlock === 'context') {
                        currentItem.context[k] = v;
                    }
                }
            }
        } else if (section === 'clusters') {
            const itemStartMatch = rawLine.match(/^\s*-\s+(.*)$/);
            if (itemStartMatch) {
                currentItem = { name: '', cluster: {} };
                result.clusters!.push(currentItem);
                inSubBlock = null;

                const rest = itemStartMatch[1].trim();
                const restKv = rest.match(/^([a-zA-Z0-9_-]+)\s*:\s*(.*)$/);
                if (restKv) {
                    const k = restKv[1];
                    const v = restKv[2].trim().replace(/^['"]|['"]$/g, '');
                    if (k === 'name') {
                        currentItem.name = v;
                    } else if (k === 'cluster') {
                        inSubBlock = 'cluster';
                    }
                }
                continue;
            }

            if (currentItem) {
                const kvMatch = rawLine.match(/^\s+([a-zA-Z0-9_-]+)\s*:\s*(.*)$/);
                if (kvMatch) {
                    const k = kvMatch[1];
                    const v = kvMatch[2].trim().replace(/^['"]|['"]$/g, '');
                    if (k === 'cluster') {
                        inSubBlock = 'cluster';
                    } else if (k === 'name' && !inSubBlock) {
                        currentItem.name = v;
                    } else if (inSubBlock === 'cluster') {
                        currentItem.cluster[k] = v;
                    }
                }
            }
        }
    }

    return result;
}
