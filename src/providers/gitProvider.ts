import * as vscode from 'vscode';

export interface GitStatus {
    branch: string | null;
    isMainBranch: boolean;
}

// Branch names that should trigger a warning
const MAIN_BRANCH_NAMES = ['main', 'master', 'trunk', 'develop'];

export async function getGitStatus(): Promise<GitStatus> {
    try {
        // Try to get Git extension
        const gitExtension = vscode.extensions.getExtension('vscode.git');

        if (!gitExtension) {
            return { branch: null, isMainBranch: false };
        }

        // Activate if needed
        const git = gitExtension.isActive
            ? gitExtension.exports
            : await gitExtension.activate();

        const api = git.getAPI(1);

        if (!api || api.repositories.length === 0) {
            return { branch: null, isMainBranch: false };
        }

        // Get the first repository (primary workspace)
        const repo = api.repositories[0];
        const head = repo.state.HEAD;

        if (!head || !head.name) {
            return { branch: null, isMainBranch: false };
        }

        const branch = head.name;
        const isMainBranch = MAIN_BRANCH_NAMES.includes(branch.toLowerCase());

        return {
            branch,
            isMainBranch
        };
    } catch (error) {
        return { branch: null, isMainBranch: false };
    }
}
