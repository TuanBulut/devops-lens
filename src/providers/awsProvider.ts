import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface AwsStatus {
    profile: string | null;
}

export async function getAwsStatus(): Promise<AwsStatus> {
    // Check environment variables first (highest priority)
    const envProfile = process.env.AWS_PROFILE || process.env.AWS_DEFAULT_PROFILE;

    if (envProfile) {
        return { profile: envProfile };
    }

    // Try to read from ~/.aws/credentials to see if default profile exists
    try {
        const credentialsPath = path.join(os.homedir(), '.aws', 'credentials');

        if (fs.existsSync(credentialsPath)) {
            const content = fs.readFileSync(credentialsPath, 'utf-8');

            // Check if default profile exists
            if (content.includes('[default]')) {
                return { profile: 'default' };
            }

            // Get first available profile
            const profileMatch = content.match(/\[([^\]]+)\]/);
            if (profileMatch) {
                return { profile: profileMatch[1] };
            }
        }
    } catch (error) {
        // Ignore file read errors
    }

    return { profile: null };
}
