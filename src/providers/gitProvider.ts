import * as vscode from 'vscode';
import { GitStatus } from './types';
import { isProductionContext } from './kubernetesProvider';

export async function getGitStatus(): Promise<GitStatus> {
    const config = vscode.workspace.getConfiguration('devopsLens');
    const customKeywords = config.get<string[]>('productionKeywords', []);

    try {
        const gitExtension = vscode.extensions.getExtension('vscode.git');
        if (!gitExtension) {
            return getEmptyGitStatus();
        }

        const git = gitExtension.isActive
            ? gitExtension.exports
            : await gitExtension.activate();

        const api = git.getAPI(1);
        if (!api || api.repositories.length === 0) {
            return getEmptyGitStatus();
        }

        const repo = api.repositories[0];
        const head = repo.state.HEAD;

        if (!head || !head.name) {
            return getEmptyGitStatus();
        }

        const branch = head.name;
        const isMainBranch = ['main', 'master', 'trunk', 'production', 'prod'].includes(branch.toLowerCase()) ||
            isProductionContext(branch, customKeywords);

        const stagedCount = repo.state.indexChanges?.length || 0;
        const unstagedCount = repo.state.workingTreeChanges?.length || 0;
        const untrackedCount = repo.state.untrackedChanges?.length || 0;
        const isClean = (stagedCount + unstagedCount + untrackedCount) === 0;

        const ahead = head.ahead || 0;
        const behind = head.behind || 0;

        let lastCommit: { hash: string; message: string; author: string } | null = null;
        if (head.commit) {
            try {
                const commits = await repo.log({ maxEntries: 1 });
                if (commits && commits.length > 0) {
                    lastCommit = {
                        hash: commits[0].hash.substring(0, 7),
                        message: commits[0].message.split('\n')[0],
                        author: commits[0].authorName || ''
                    };
                }
            } catch {
                lastCommit = {
                    hash: head.commit.substring(0, 7),
                    message: '',
                    author: ''
                };
            }
        }

        return {
            branch,
            isMainBranch,
            isClean,
            stagedCount,
            unstagedCount,
            untrackedCount,
            ahead,
            behind,
            lastCommit
        };
    } catch {
        return getEmptyGitStatus();
    }
}

function getEmptyGitStatus(): GitStatus {
    return {
        branch: null,
        isMainBranch: false,
        isClean: true,
        stagedCount: 0,
        unstagedCount: 0,
        untrackedCount: 0,
        ahead: 0,
        behind: 0,
        lastCommit: null
    };
}

export function subscribeToGitChanges(callback: () => void): vscode.Disposable[] {
    const disposables: vscode.Disposable[] = [];
    const gitExtension = vscode.extensions.getExtension('vscode.git');
    if (!gitExtension) {
        return disposables;
    }

    const setupListener = (gitApi: any) => {
        if (!gitApi) {
            return;
        }
        for (const repo of gitApi.repositories) {
            disposables.push(repo.state.onDidChange(() => callback()));
        }
        disposables.push(gitApi.onDidOpenRepository((repo: any) => {
            disposables.push(repo.state.onDidChange(() => callback()));
            callback();
        }));
    };

    if (gitExtension.isActive) {
        setupListener(gitExtension.exports?.getAPI(1));
    } else {
        Promise.resolve(gitExtension.activate()).then(exports => {
            setupListener(exports?.getAPI(1));
        }).catch(() => {});
    }

    return disposables;
}
