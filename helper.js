const { execSync } = require('child_process');
const os = require("os");

const DEBUG = process.env.DEBUG || false;

// Add debug logging function
function debugLog(...args) {
    if (DEBUG) {
        console.log('[DEBUG]', ...args);
    }
}

function errorLog(...args) {
    console.log('[ERROR]', ...args);
    // console.error(args);
}

function getCPUUsage() {
    try {
        let cpuCount;

        // Get CPU count
        const cpuMax = execSync("cat /sys/fs/cgroup/cpu.max").toString().trim();
        const [cpuQuota, cpuPeriod] = cpuMax.split(" ").map(Number);
        cpuCount = cpuQuota !== -1 ? Math.max(1, Math.floor(cpuQuota / cpuPeriod)) : os.cpus().length;

        // Get first reading
        const usage1 = parseInt(execSync("cat /sys/fs/cgroup/cpu.stat").toString()
            .split('\n')
            .find(line => line.startsWith('usage_usec'))
            ?.split(' ')[1] || '0');

        // Wait 100ms
        execSync('sleep 0.1');

        // Get second reading
        const usage2 = parseInt(execSync("cat /sys/fs/cgroup/cpu.stat").toString()
            .split('\n')
            .find(line => line.startsWith('usage_usec'))
            ?.split(' ')[1] || '0');

        // Calculate percentage based on delta over 100ms
        const usageDelta = usage2 - usage1;
        // 100ms = 100000 microseconds
        // If process uses 100000 microseconds over 100ms period, that's 100% of one CPU
        const cpuUsage = ((usageDelta / 100000) * 100).toFixed(2); // Convert to percentage

        return {
            cpuCount,
            cpuUsage: Math.min(parseFloat(cpuUsage), cpuCount * 100), // Cap at max possible usage
            source: 'cgroup v2',
            isError: false
        };
    } catch (error) {
        console.error("❌ Error fetching CPU usage:", error.message);
        return {
            cpuCount: 0,
            cpuUsage: 0,
            source: 'unknown',
            isError: true
        }
    }
}


function getMemoryUsage() {
    const ONE_MB = 1024 * 1024;
    try {
        let containerTotal, containerUsed;

        try {
            // Try cgroup v2 first
            const memMax = parseInt(execSync("cat /sys/fs/cgroup/memory.max").toString());
            const memCurrent = parseInt(execSync("cat /sys/fs/cgroup/memory.current").toString());

            containerTotal = memMax / ONE_MB;
            containerUsed = memCurrent / ONE_MB;
        } catch (e) {
            try {
                // Fallback to cgroup v1
                const memLimit = parseInt(execSync("cat /sys/fs/cgroup/memory/memory.limit_in_bytes").toString());
                const memUsage = parseInt(execSync("cat /sys/fs/cgroup/memory/memory.usage_in_bytes").toString());

                containerTotal = memLimit / ONE_MB;
                containerUsed = memUsage / ONE_MB;
            } catch (e2) {
                // Try legacy location
                const memLimit = parseInt(execSync("cat /sys/fs/cgroup/memory.limit_in_bytes").toString());
                const memUsage = parseInt(execSync("cat /sys/fs/cgroup/memory.usage_in_bytes").toString());

                containerTotal = memLimit / ONE_MB;
                containerUsed = memUsage / ONE_MB;
            }
        }

        // Get heap memory
        const memoryUsage = process.memoryUsage();
        const heapTotal = memoryUsage.heapTotal / ONE_MB;
        const heapUsed = memoryUsage.heapUsed / ONE_MB;

        return {
            containerTotal: containerTotal.toFixed(2),
            containerUsed: containerUsed.toFixed(2),
            containerUsagePercentage: ((containerUsed / containerTotal) * 100).toFixed(2),
            // heapTotal: heapTotal.toFixed(2),
            // heapUsed: heapUsed.toFixed(2),
            // heapUsagePercentage: ((heapUsed / heapTotal) * 100).toFixed(2)
        };
    } catch (error) {
        debugLog('Error getting container memory:', error);
        // Fallback to OS memory if container stats unavailable
        return {
            containerTotal: (os.totalmem() / ONE_MB).toFixed(2),
            containerUsed: ((os.totalmem() - os.freemem()) / ONE_MB).toFixed(2),
            containerUsagePercentage: ((1 - os.freemem() / os.totalmem()) * 100).toFixed(2)
        };
    }
}

// Add these functions
function getZombieProcesses() {
    try {
        // Find chrome processes that are zombies (defunct)
        const cmd = "ps aux | grep chrome | grep defunct | awk '{print $2}'";
        return execSync(cmd).toString().trim().split('\n').filter(Boolean);
    } catch (error) {
        debugLog('Error getting zombie processes:', error);
        return [];
    }
}

function getOrphanedChromeProcesses() {
    try {
        // Find chrome processes running longer than 5 minutes
        const cmd = "ps -eo pid,etimes,cmd | grep chrom | grep -v grep | awk '$2 > 300 {print $1}'";
        return execSync(cmd).toString().trim().split('\n').filter(Boolean);
    } catch (error) {
        debugLog('Error getting orphaned processes:', error);
        return [];
    }
}

async function cleanupChromeProcesses() {
    try {
        // Kill zombie processes
        const zombies = getZombieProcesses();
        if (zombies.length) {
            debugLog(`Found ${zombies.length} zombie chrome processes`);
            zombies.forEach(pid => {
                try {
                    process.kill(parseInt(pid), 'SIGKILL');
                    debugLog(`Killed zombie process ${pid}`);
                } catch (e) {
                    if (e.code !== 'ESRCH') {
                        debugLog(`Failed to kill zombie ${pid}:`, e);
                    }
                }
            });
        }

        // Kill orphaned processes
        const orphaned = getOrphanedChromeProcesses();
        if (orphaned.length) {
            debugLog(`Found ${orphaned.length} orphaned chrome processes`);
            orphaned.forEach(pid => {
                try {
                    process.kill(parseInt(pid), 'SIGKILL');
                    debugLog(`Killed orphaned process ${pid}`);
                } catch (e) {
                    debugLog(`Failed to kill orphaned ${pid}:`, e);
                }
            });
        }

        // // Cleanup any remaining headless chrome instances
        // exec('pkill -f "(chrome)?(--headless)"', (err) => {
        //   if (err && err.code !== 1) debugLog('Chrome cleanup error:', err);
        // });
    } catch (error) {
        debugLog('Cleanup error:', error);
    }
}

module.exports = {
    getCPUUsage,
    getZombieProcesses,
    getOrphanedChromeProcesses,
    cleanupChromeProcesses,
    debugLog,
    errorLog,
    DEBUG,
    getMemoryUsage
}