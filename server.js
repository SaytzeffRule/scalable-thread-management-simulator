const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname)));

// In-memory storage for threads
let threads = [];
let threadIdCounter = 1;

/**
 * FCFS (First Come First Serve) Scheduling Algorithm
 * Processes threads in the order they arrive
 * No preemption
 */
function fcfsScheduling(threadsData) {
  if (threadsData.length === 0) {
    throw new Error('No threads available for scheduling');
  }

  const threads = threadsData.map(t => ({ ...t }));
  const schedule = [];
  let currentTime = 0;

  // FCFS processes threads in order
  threads.forEach(thread => {
    schedule.push({
      threadId: thread.id,
      startTime: currentTime,
      endTime: currentTime + thread.burstTime,
      burstTime: thread.burstTime
    });
    currentTime += thread.burstTime;
  });

  // Calculate metrics
  const metrics = calculateMetrics(threads, schedule);
  return {
    schedule,
    ...metrics
  };
}

/**
 * Round Robin Scheduling Algorithm
 * Each thread gets a time quantum to execute
 * If not completed, goes to back of queue
 */
function roundRobinScheduling(threadsData, timeQuantum) {
  if (threadsData.length === 0) {
    throw new Error('No threads available for scheduling');
  }

  if (!timeQuantum || timeQuantum <= 0) {
    throw new Error('Time quantum must be greater than 0');
  }

  const threads = threadsData.map(t => ({
    ...t,
    remainingTime: t.burstTime,
    startTime: null,
    firstStartTime: null
  }));

  const schedule = [];
  const queue = [...threads];
  let currentTime = 0;

  while (queue.length > 0) {
    const thread = queue.shift();

    // Record first start time
    if (thread.firstStartTime === null) {
      thread.firstStartTime = currentTime;
    }

    const executionTime = Math.min(thread.remainingTime, timeQuantum);

    schedule.push({
      threadId: thread.id,
      startTime: currentTime,
      endTime: currentTime + executionTime,
      burstTime: executionTime
    });

    currentTime += executionTime;
    thread.remainingTime -= executionTime;

    // If thread still has time remaining, add back to queue
    if (thread.remainingTime > 0) {
      queue.push(thread);
    }
  }

  // Calculate metrics
  const metrics = calculateMetricsForRR(threads, schedule);
  return {
    schedule,
    ...metrics
  };
}

/**
 * Priority Scheduling (Non-preemptive)
 * Higher priority threads execute first
 * Lower priority value = Higher priority
 */
function priorityScheduling(threadsData) {
  if (threadsData.length === 0) {
    throw new Error('No threads available for scheduling');
  }

  // Sort by priority (lower value = higher priority)
  // If same priority, maintain arrival order (FCFS)
  const threads = threadsData
    .map((t, index) => ({ ...t, arrivalIndex: index }))
    .sort((a, b) => {
      if (a.priority === b.priority) {
        return a.arrivalIndex - b.arrivalIndex;
      }
      return a.priority - b.priority;
    });

  const schedule = [];
  let currentTime = 0;

  threads.forEach(thread => {
    schedule.push({
      threadId: thread.id,
      startTime: currentTime,
      endTime: currentTime + thread.burstTime,
      burstTime: thread.burstTime
    });
    currentTime += thread.burstTime;
  });

  // Calculate metrics
  const metrics = calculateMetrics(threads, schedule);
  return {
    schedule,
    ...metrics
  };
}

/**
 * SJF (Shortest Job First) Scheduling Algorithm
 * Processes threads with shortest burst time first
 * No preemption
 */
function sjfScheduling(threadsData) {
  if (threadsData.length === 0) {
    throw new Error('No threads available for scheduling');
  }

  // Sort by burst time (ascending)
  // If same burst time, maintain arrival order
  const threads = threadsData
    .map((t, index) => ({ ...t, arrivalIndex: index }))
    .sort((a, b) => {
      if (a.burstTime === b.burstTime) {
        return a.arrivalIndex - b.arrivalIndex;
      }
      return a.burstTime - b.burstTime;
    });

  const schedule = [];
  let currentTime = 0;

  threads.forEach(thread => {
    schedule.push({
      threadId: thread.id,
      startTime: currentTime,
      endTime: currentTime + thread.burstTime,
      burstTime: thread.burstTime
    });
    currentTime += thread.burstTime;
  });

  // Calculate metrics
  const metrics = calculateMetrics(threads, schedule);
  return {
    schedule,
    ...metrics
  };
}

/**
 * Calculate Waiting Time, Turnaround Time, and Response Time
 */
function calculateMetrics(threads, schedule) {
  const waitingTimes = {};
  const turnaroundTimes = {};
  const responseTimes = {};

  threads.forEach((thread) => {
    // Find when this thread starts execution
    const execution = schedule.find(s => s.threadId === thread.id);
    
    if (!execution) {
      waitingTimes[thread.id] = 0;
      turnaroundTimes[thread.id] = 0;
      responseTimes[thread.id] = 0;
      return;
    }

    const arrivalTime = thread.arrivalTime || 0;
    
    // Waiting time = start time - arrival time
    waitingTimes[thread.id] = Math.max(0, execution.startTime - arrivalTime);
    
    // Turnaround time = end time - arrival time
    turnaroundTimes[thread.id] = execution.endTime - arrivalTime;
    
    // Response time = first execution start time - arrival time
    responseTimes[thread.id] = Math.max(0, execution.startTime - arrivalTime);
  });

  // Calculate averages
  const threadIds = Object.keys(waitingTimes);
  const avgWaitingTime = threadIds.length > 0
    ? threadIds.reduce((sum, id) => sum + waitingTimes[id], 0) / threadIds.length
    : 0;

  const avgTurnaroundTime = threadIds.length > 0
    ? threadIds.reduce((sum, id) => sum + turnaroundTimes[id], 0) / threadIds.length
    : 0;

  const avgResponseTime = threadIds.length > 0
    ? threadIds.reduce((sum, id) => sum + responseTimes[id], 0) / threadIds.length
    : 0;

  return {
    waitingTimes,
    turnaroundTimes,
    responseTimes,
    avgWaitingTime: parseFloat(avgWaitingTime.toFixed(2)),
    avgTurnaroundTime: parseFloat(avgTurnaroundTime.toFixed(2)),
    avgResponseTime: parseFloat(avgResponseTime.toFixed(2))
  };
}

/**
 * Calculate metrics for Round Robin (accounts for multiple scheduling)
 */
function calculateMetricsForRR(threads, schedule) {
  const waitingTimes = {};
  const turnaroundTimes = {};
  const responseTimes = {};
  const completionTimes = {};
  const firstStartTimes = {};

  // Find completion time and first start time for each thread
  schedule.forEach(exec => {
    if (!completionTimes[exec.threadId] || exec.endTime > completionTimes[exec.threadId]) {
      completionTimes[exec.threadId] = exec.endTime;
    }
    if (!firstStartTimes[exec.threadId]) {
      firstStartTimes[exec.threadId] = exec.startTime;
    }
  });

  threads.forEach(thread => {
    const arrivalTime = thread.arrivalTime || 0;
    const completionTime = completionTimes[thread.id] || 0;
    const firstStartTime = firstStartTimes[thread.id] || 0;

    // Waiting time = completion time - burst time - arrival time
    waitingTimes[thread.id] = Math.max(0, completionTime - thread.burstTime - arrivalTime);

    // Turnaround time = completion time - arrival time
    turnaroundTimes[thread.id] = Math.max(0, completionTime - arrivalTime);
    
    // Response time = first execution start time - arrival time
    responseTimes[thread.id] = Math.max(0, firstStartTime - arrivalTime);
  });

  const threadIds = Object.keys(waitingTimes);
  const avgWaitingTime = threadIds.length > 0
    ? threadIds.reduce((sum, id) => sum + waitingTimes[id], 0) / threadIds.length
    : 0;

  const avgTurnaroundTime = threadIds.length > 0
    ? threadIds.reduce((sum, id) => sum + turnaroundTimes[id], 0) / threadIds.length
    : 0;

  const avgResponseTime = threadIds.length > 0
    ? threadIds.reduce((sum, id) => sum + responseTimes[id], 0) / threadIds.length
    : 0;

  return {
    waitingTimes,
    turnaroundTimes,
    responseTimes,
    avgWaitingTime: parseFloat(avgWaitingTime.toFixed(2)),
    avgTurnaroundTime: parseFloat(avgTurnaroundTime.toFixed(2)),
    avgResponseTime: parseFloat(avgResponseTime.toFixed(2))
  };
}

// ============== API ENDPOINTS ==============

/**
 * POST /add-thread
 * Add a new thread to the list
 * Body: { id, arrivalTime, burstTime, priority }
 */
app.post('/add-thread', (req, res) => {
  try {
    const { id, arrivalTime, burstTime, priority } = req.body;

    // Validation
    if (!id || id.trim() === '') {
      return res.status(400).json({ error: 'Thread ID is required' });
    }

    if (!burstTime || burstTime <= 0) {
      return res.status(400).json({ error: 'Burst time must be greater than 0' });
    }

    if (priority === undefined || priority === null || priority < 0) {
      return res.status(400).json({ error: 'Priority must be a non-negative number' });
    }

    // Check for duplicate ID
    if (threads.find(t => t.id === id)) {
      return res.status(400).json({ error: `Thread with ID "${id}" already exists` });
    }

    // Add thread
    const newThread = {
      id: id.toString(),
      arrivalTime: Math.max(0, parseInt(arrivalTime) || 0),
      burstTime: parseInt(burstTime),
      priority: parseInt(priority),
      addedAt: Date.now()
    };

    threads.push(newThread);

    res.status(201).json({
      message: 'Thread added successfully',
      thread: newThread,
      totalThreads: threads.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /threads
 * Retrieve all threads
 */
app.get('/threads', (req, res) => {
  try {
    res.json({
      threads: threads,
      count: threads.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /threads/:id
 * Delete a specific thread
 */
app.delete('/threads/:id', (req, res) => {
  try {
    const { id } = req.params;
    const index = threads.findIndex(t => t.id === id);

    if (index === -1) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    const deletedThread = threads.splice(index, 1);
    res.json({
      message: 'Thread deleted successfully',
      thread: deletedThread[0]
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /threads
 * Clear all threads
 */
app.delete('/threads', (req, res) => {
  try {
    const count = threads.length;
    threads = [];
    res.json({
      message: `${count} thread(s) cleared successfully`,
      remaining: threads.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /simulate
 * Run scheduling simulation
 * Body: { algorithm, timeQuantum (optional), threads }
 * 
 * TEST CASE:
 * T1 (AT=0, BT=5, Priority=1), T2 (AT=1, BT=3, Priority=2), T3 (AT=2, BT=1, Priority=3)
 * 
 * FCFS Expected: T1(0-5) → T2(5-8) → T3(8-9)
 * SJF Expected: T1(0-5) → T3(5-6) → T2(6-9)
 * Round Robin (TQ=2): T1(0-2) → T2(2-4) → T3(4-5) → T1(5-7) → T2(7-8) → T1(8-9)
 * Priority: T1(0-5) → T2(5-8) → T3(8-9)
 */
app.post('/simulate', (req, res) => {
  try {
    const { algorithm, timeQuantum, threads: threadData } = req.body;

    if (!algorithm) {
      return res.status(400).json({ error: 'Algorithm is required' });
    }

    const scheduleThreads = threadData && threadData.length > 0 ? threadData : threads;

    if (scheduleThreads.length === 0) {
      return res.status(400).json({ error: 'No threads available for simulation. Please add threads first.' });
    }

    let result;

    switch (algorithm.toLowerCase()) {
      case 'fcfs':
        result = fcfsScheduling(scheduleThreads);
        break;

      case 'sjf':
        result = sjfScheduling(scheduleThreads);
        break;

      case 'round-robin':
        if (!timeQuantum || timeQuantum <= 0) {
          return res.status(400).json({ error: 'Time quantum is required and must be greater than 0 for Round Robin' });
        }
        result = roundRobinScheduling(scheduleThreads, timeQuantum);
        break;

      case 'priority':
        result = priorityScheduling(scheduleThreads);
        break;

      default:
        return res.status(400).json({ error: 'Invalid algorithm. Use: fcfs, sjf, round-robin, or priority' });
    }

    res.json({
      algorithm: algorithm.toLowerCase(),
      threadsCount: scheduleThreads.length,
      timeQuantum: algorithm.toLowerCase() === 'round-robin' ? timeQuantum : null,
      ...result
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /reset
 * Reset the application
 */
app.post('/reset', (req, res) => {
  try {
    threads = [];
    res.json({ message: 'Application reset successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============== SERVER START ==============

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════╗
║   Thread Management Library Simulator              ║
║   Server running on http://localhost:${PORT}     ║
╚════════════════════════════════════════════════════╝
  `);
  console.log('Supported Algorithms:');
  console.log('  • FCFS (First Come First Serve)');
  console.log('  • SJF (Shortest Job First)');
  console.log('  • Round Robin');
  console.log('  • Priority Scheduling');
  console.log('\nOpen index.html in your browser to get started!');
});
