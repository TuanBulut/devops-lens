import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { AwsStatus } from './types';
import { isProductionContext } from './kubernetesProvider';

const execAsync = promisify(exec);

let activeSessionProfile: string | null = null;

export function setActiveSessionProfile(profile: string | null): void {
    activeSessionProfile = profile;
}

export function getActiveSessionProfile(): string | null {
    return activeSessionProfile;
}

export function getAwsConfigPaths(): { credentialsPath: string; configPath: string } {
    const home = os.homedir();
    return {
        credentialsPath: path.join(home, '.aws', 'credentials'),
        configPath: path.join(home, '.aws', 'config')
    };
}

/**
 * Parses INI-style AWS configuration files
 */
export function parseAwsIniFile(filePath: string): Map<string, Record<string, string>> {
    const result = new Map<string, Record<string, string>>();
    if (!fs.existsSync(filePath)) {
        return result;
    }

    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split(/\r?\n/);
        let currentSection: string | null = null;
        let currentProps: Record<string, string> = {};

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith(';')) {
                continue;
            }

            const sectionMatch = trimmed.match(/^\[([^\]]+)\]$/);
            if (sectionMatch) {
                if (currentSection) {
                    result.set(currentSection, currentProps);
                }
                let rawSection = sectionMatch[1].trim();
                // In ~/.aws/config, profiles are named [profile name] or [default]
                if (rawSection.startsWith('profile ')) {
                    rawSection = rawSection.substring('profile '.length).trim();
                }
                currentSection = rawSection;
                currentProps = {};
                continue;
            }

            const kvMatch = trimmed.match(/^([^=]+)=(.*)$/);
            if (kvMatch && currentSection) {
                const key = kvMatch[1].trim().toLowerCase();
                const value = kvMatch[2].trim();
                currentProps[key] = value;
            }
        }

        if (currentSection) {
            result.set(currentSection, currentProps);
        }
    } catch {
        // Return whatever parsed so far
    }

    return result;
}

/**
 * Checks workspace .env / .env.local for AWS_PROFILE or AWS_REGION
 */
function checkWorkspaceEnv(): { profile?: string; region?: string } {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
        return {};
    }

    const envFiles = ['.env.local', '.env'];
    for (const folder of folders) {
        for (const envFile of envFiles) {
            const fullPath = path.join(folder.uri.fsPath, envFile);
            if (fs.existsSync(fullPath)) {
                try {
                    const content = fs.readFileSync(fullPath, 'utf-8');
                    const lines = content.split(/\r?\n/);
                    let profile: string | undefined;
                    let region: string | undefined;

                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (trimmed.startsWith('#') || !trimmed.includes('=')) {
                            continue;
                        }
                        const [key, ...vals] = trimmed.split('=');
                        const val = vals.join('=').trim().replace(/^['"]|['"]$/g, '');
                        if (key === 'AWS_PROFILE' || key === 'AWS_DEFAULT_PROFILE') {
                            profile = val;
                        } else if (key === 'AWS_REGION' || key === 'AWS_DEFAULT_REGION') {
                            region = val;
                        }
                    }

                    if (profile || region) {
                        return { profile, region };
                    }
                } catch {
                    // Ignore
                }
            }
        }
    }
    return {};
}

export async function getAwsStatus(): Promise<AwsStatus> {
    const config = vscode.workspace.getConfiguration('devopsLens');
    const customKeywords = config.get<string[]>('productionKeywords', []);

    const { credentialsPath, configPath } = getAwsConfigPaths();
    const credentials = parseAwsIniFile(credentialsPath);
    const awsConfigs = parseAwsIniFile(configPath);

    // Combine all discovered profile names
    const allProfileSet = new Set<string>();
    for (const p of credentials.keys()) {
        allProfileSet.add(p);
    }
    for (const p of awsConfigs.keys()) {
        allProfileSet.add(p);
    }
    const allProfiles = Array.from(allProfileSet).sort();

    // Determine current active profile:
    // Priority:
    // 1. Session override
    // 2. Workspace .env
    // 3. Process env
    // 4. 'default' if present in credentials or config
    // 5. First discovered profile
    let activeProfile: string | null = null;
    let activeRegion: string | null = null;

    if (activeSessionProfile) {
        activeProfile = activeSessionProfile;
    } else {
        const workspaceEnv = checkWorkspaceEnv();
        if (workspaceEnv.profile) {
            activeProfile = workspaceEnv.profile;
        }
        if (workspaceEnv.region) {
            activeRegion = workspaceEnv.region;
        }

        if (!activeProfile) {
            activeProfile = process.env.AWS_PROFILE || process.env.AWS_DEFAULT_PROFILE || null;
        }

        if (!activeRegion) {
            activeRegion = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || null;
        }

        if (!activeProfile) {
            if (allProfileSet.has('default')) {
                activeProfile = 'default';
            } else if (allProfiles.length > 0) {
                activeProfile = allProfiles[0];
            }
        }
    }

    // Lookup region from ~/.aws/config for the active profile if not yet determined
    if (activeProfile && !activeRegion) {
        const profileProps = awsConfigs.get(activeProfile);
        if (profileProps && profileProps.region) {
            activeRegion = profileProps.region;
        } else if (awsConfigs.has('default')) {
            activeRegion = awsConfigs.get('default')?.region || null;
        }
    }

    const isProduction = isProductionContext(activeProfile, customKeywords);

    return {
        profile: activeProfile,
        region: activeRegion,
        accountId: null,
        isProduction,
        allProfiles
    };
}
