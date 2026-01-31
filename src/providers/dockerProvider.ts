import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface DockerStatus {
    isRunning: boolean;
    containerCount: number;
}

export async function getDockerStatus(): Promise<DockerStatus> {
    try {
        // Get list of running container IDs
        const { stdout } = await execAsync('docker ps -q', {
            timeout: 5000
        });

        // Count containers (each ID is on a new line)
        const containerIds = stdout.trim().split('\n').filter(id => id.length > 0);

        return {
            isRunning: true,
            containerCount: containerIds.length
        };
    } catch (error) {
        // Docker not running or not installed
        return {
            isRunning: false,
            containerCount: 0
        };
    }
}
