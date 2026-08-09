/**
 * ================================================================
 * MELROSEOS 4.0 — AI WORKBENCH
 * Version 4.0.0
 *
 * Staged setup to avoid Spreadsheet service timeouts.
 *
 * Public functions:
 * - setupMelroseAIWorkbenchStep1()
 * - setupMelroseAIWorkbenchStep2()
 * - setupMelroseAIWorkbenchStep3()
 * - setupMelroseAIWorkbenchFinalize()
 * - createAIWorkbenchTask()
 * - processSelectedAIWorkbenchTask()
 * - approveSelectedAIWorkbenchTask()
 * - archiveSelectedAIWorkbenchTask()
 * - refreshMelroseAIWorkbench()
 * - openMelroseAIWorkbench()
 * - testMelroseAIWorkbench()
 * ================================================================
 */

var M4_AI_WORKBENCH = Object.freeze({
  VERSION: '4.0.0',
  MODULE: 'AI_WORKBENCH',

  SHEETS: Object.freeze({
    TASKS: 'AIWorkbench',
    PROMPTS: 'AIPromptLibrary',
    OUTPUTS: 'AIOutputLibrary'
  }),

  TASK_STATUSES: Object.freeze([
    'NEW',
    'READY',
    'IN_PROGRESS',
    'COMPLETED',
    'APPROVED',
    'REVISE',
    'FAILED',
    'ARCHIVED'
  ]),

  TASK_TYPES: Object.freeze([
    'AD_COPY',
    'SOCIAL_POST',
    'EMAIL',
    'BLOG',
    'LISTING_REMARKS',
    'CAMPAIGN_PLAN',
    'COMPLIANCE_REWRITE',
    'OTHER'
  ]),

  OUTPUT_STATUSES: Object.freeze([
    'DRAFT',
    'READY_FOR_REVIEW',
    'APPROVED',
    'REVISE',
    'ARCHIVED'
  ])
});


/* =================================================================
   STAGED SETUP
================================================================= */

function setupMelroseAIWorkbenchStep1() {
  const ss = m4_getCommandCenter_();

  m4_aiEnsureSheetDirect_(
    ss,
    M4_AI_WORKBENCH.SHEETS.TASKS,
    [
      'TaskID',
      'TaskName',
      'TaskType',
      'SourceModule',
      'SourceRecordID',
      'PromptID',
      'PromptText',
      'InputText',
      'RequestedTone',
      'RequestedLength',
      'ComplianceRequired',
      'Status',
      'OutputID',
      'ErrorMessage',
      'CreatedAt',
      'CreatedBy',
      'UpdatedAt',
      'UpdatedBy',
      'AIWorkbenchVersion'
    ]
  );

  return {
    success: true,
    step: 1,
    nextFunction: 'setupMelroseAIWorkbenchStep2'
  };
}


function setupMelroseAIWorkbenchStep2() {
  const ss = m4_getCommandCenter_();

  m4_aiEnsureSheetDirect_(
    ss,
    M4_AI_WORKBENCH.SHEETS.PROMPTS,
    [
      'PromptID',
      'PromptName',
      'TaskType',
      'PromptTemplate',
      'DefaultTone',
      'DefaultLength',
      'ComplianceRequired',
      'Active',
      'CreatedAt',
      'UpdatedAt',
      'AIWorkbenchVersion'
    ]
  );

  return {
    success: true,
    step: 2,
    nextFunction: 'setupMelroseAIWorkbenchStep3'
  };
}


function setupMelroseAIWorkbenchStep3() {
  const ss = m4_getCommandCenter_();

  m4_aiEnsureSheetDirect_(
    ss,
    M4_AI_WORKBENCH.SHEETS.OUTPUTS,
    [
      'OutputID',
      'TaskID',
      'OutputText',
      'OutputStatus',
      'ComplianceStatus',
      'BrokerApproved',
      'ComplianceApproved',
      'CreatedAt',
      'UpdatedAt',
      'ApprovedAt',
      'ApprovedBy',
      'Notes',
      'AIWorkbenchVersion'
    ]
  );

  seedMelroseAIWorkbench();

  return {
    success: true,
    step: 3,
    nextFunction: 'setupMelroseAIWorkbenchFinalize'
  };
}


function setupMelroseAIWorkbenchFinalize() {
  try {
    m4_setSetting_(
      'AI_WORKBENCH_VERSION',
      M4_AI_WORKBENCH.VERSION,
      {
        type: 'STRING',
        category: 'AI',
        description: 'Installed AI Workbench version.',
        required: true
      }
    );
  } catch (ignored) {}

  return {
    success: true,
    version: M4_AI_WORKBENCH.VERSION,
    setupComplete: true
  };
}


function setupMelroseAIWorkbench() {
  return setupMelroseAIWorkbenchStep1();
}


/* =================================================================
   DIRECT SHEET CREATION
================================================================= */

function m4_aiEnsureSheetDirect_(ss, sheetName, headers) {
  let sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    sheet = m4_aiRetry_(
      () => ss.insertSheet(sheetName),
      `Create ${sheetName}`
    );

    m4_aiRetry_(
      () => sheet
        .getRange(1, 1, 1, headers.length)
        .setValues([headers]),
      `Write headers for ${sheetName}`
    );

    try {
      sheet.setFrozenRows(1);
    } catch (ignored) {}

    return sheet;
  }

  const range = m4_aiRetry_(
    () => sheet.getRange(1, 1, 1, headers.length),
    `Open header range for ${sheetName}`
  );

  const current = m4_aiRetry_(
    () => range
      .getDisplayValues()[0]
      .map(value => String(value || '').trim()),
    `Read headers for ${sheetName}`
  );

  const repaired = current.slice();

  headers.forEach((header, index) => {
    if (!repaired[index]) {
      repaired[index] = header;
    }
  });

  m4_aiRetry_(
    () => range.setValues([repaired]),
    `Repair headers for ${sheetName}`
  );

  try {
    sheet.setFrozenRows(1);
  } catch (ignored) {}

  return sheet;
}


function m4_aiRetry_(callback, operationName) {
  let lastError = null;

  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      return callback();
    } catch (error) {
      lastError = error;

      if (attempt < 5) {
        Utilities.sleep(
          1200 * Math.pow(2, attempt - 1)
        );
      }
    }
  }

  throw new Error(
    `${operationName || 'Spreadsheet operation'} failed after 5 attempts. ` +
    `${lastError && lastError.message ? lastError.message : lastError}`
  );
}


/* =================================================================
   SEEDING
================================================================= */

function seedMelroseAIWorkbench() {
  const ss = m4_getCommandCenter_();
  const sheet = ss.getSheetByName(
    M4_AI_WORKBENCH.SHEETS.PROMPTS
  );

  if (!sheet) {
    throw new Error(
      'AIPromptLibrary does not exist.'
    );
  }

  const now = new Date();

  const prompts = [
    {
      PromptID: 'PROMPT-AD-COPY',
      PromptName: 'Real Estate Ad Copy',
      TaskType: 'AD_COPY',
      PromptTemplate:
        'Write compliant real estate advertising copy using the provided audience, offer, location, and call to action. Avoid guarantees, steering language, protected-class references, and unsupported claims.',
      DefaultTone: 'PROFESSIONAL',
      DefaultLength: 'MEDIUM',
      ComplianceRequired: true,
      Active: true,
      CreatedAt: now,
      UpdatedAt: now,
      AIWorkbenchVersion: M4_AI_WORKBENCH.VERSION
    },
    {
      PromptID: 'PROMPT-SOCIAL-POST',
      PromptName: 'Social Media Post',
      TaskType: 'SOCIAL_POST',
      PromptTemplate:
        'Create a professional social media post for Melrose Group Realty using the provided topic, target audience, and call to action. Keep the language clear, local, and compliant.',
      DefaultTone: 'PROFESSIONAL',
      DefaultLength: 'SHORT',
      ComplianceRequired: true,
      Active: true,
      CreatedAt: now,
      UpdatedAt: now,
      AIWorkbenchVersion: M4_AI_WORKBENCH.VERSION
    },
    {
      PromptID: 'PROMPT-LISTING-REMARKS',
      PromptName: 'Listing Remarks',
      TaskType: 'LISTING_REMARKS',
      PromptTemplate:
        'Rewrite the supplied property details into public listing remarks and agent remarks. Preserve factual accuracy, avoid Fair Housing concerns, and do not invent features.',
      DefaultTone: 'PROFESSIONAL',
      DefaultLength: 'MEDIUM',
      ComplianceRequired: true,
      Active: true,
      CreatedAt: now,
      UpdatedAt: now,
      AIWorkbenchVersion: M4_AI_WORKBENCH.VERSION
    },
    {
      PromptID: 'PROMPT-COMPLIANCE-REWRITE',
      PromptName: 'Compliance Rewrite',
      TaskType: 'COMPLIANCE_REWRITE',
      PromptTemplate:
        'Rewrite the supplied content to remove compliance concerns while preserving the intended business message and factual meaning.',
      DefaultTone: 'PROFESSIONAL',
      DefaultLength: 'MEDIUM',
      ComplianceRequired: true,
      Active: true,
      CreatedAt: now,
      UpdatedAt: now,
      AIWorkbenchVersion: M4_AI_WORKBENCH.VERSION
    }
  ];

  prompts.forEach(record => {
    m4_upsertObject_(
      sheet,
      'PromptID',
      record
    );
  });

  return {
    success: true,
    promptsSeeded: prompts.length
  };
}


/* =================================================================
   TASK CREATION
================================================================= */

function createAIWorkbenchTask(configuration) {
  if (
    !configuration ||
    typeof configuration !== 'object'
  ) {
    throw new Error(
      'A task configuration object is required.'
    );
  }

  const ss = m4_getCommandCenter_();
  const sheet = ss.getSheetByName(
    M4_AI_WORKBENCH.SHEETS.TASKS
  );

  if (!sheet) {
    throw new Error(
      'AIWorkbench does not exist.'
    );
  }

  const taskID =
    configuration.TaskID ||
    m4_createID_('AITASK');

  const now = new Date();

  const record = {
    TaskID: taskID,
    TaskName:
      configuration.TaskName ||
      configuration.taskName ||
      'AI Workbench Task',
    TaskType:
      String(
        configuration.TaskType ||
        configuration.taskType ||
        'OTHER'
      ).toUpperCase(),
    SourceModule:
      configuration.SourceModule ||
      configuration.sourceModule ||
      '',
    SourceRecordID:
      configuration.SourceRecordID ||
      configuration.sourceRecordID ||
      '',
    PromptID:
      configuration.PromptID ||
      configuration.promptID ||
      '',
    PromptText:
      configuration.PromptText ||
      configuration.promptText ||
      '',
    InputText:
      configuration.InputText ||
      configuration.inputText ||
      '',
    RequestedTone:
      configuration.RequestedTone ||
      configuration.requestedTone ||
      'PROFESSIONAL',
    RequestedLength:
      configuration.RequestedLength ||
      configuration.requestedLength ||
      'MEDIUM',
    ComplianceRequired:
      configuration.ComplianceRequired === false
        ? false
        : true,
    Status: 'NEW',
    OutputID: '',
    ErrorMessage: '',
    CreatedAt: now,
    CreatedBy: m4_currentUser_(),
    UpdatedAt: now,
    UpdatedBy: m4_currentUser_(),
    AIWorkbenchVersion:
      M4_AI_WORKBENCH.VERSION
  };

  m4_upsertObject_(
    sheet,
    'TaskID',
    record
  );

  return {
    success: true,
    taskID
  };
}


/* =================================================================
   PROCESS SELECTED TASK
================================================================= */

function processSelectedAIWorkbenchTask() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  if (!ss) {
    throw new Error(
      'Open the Command Center spreadsheet first.'
    );
  }

  const taskSheet = ss.getActiveSheet();

  if (
    taskSheet.getName() !==
    M4_AI_WORKBENCH.SHEETS.TASKS
  ) {
    throw new Error(
      'Open AIWorkbench and select a task row.'
    );
  }

  const row = taskSheet.getActiveRange().getRow();

  if (row < 2) {
    throw new Error(
      'Select a task data row.'
    );
  }

  const task = m4_readRowObject_(
    taskSheet,
    row
  );

  if (!task.TaskID) {
    throw new Error(
      'The selected row does not contain a TaskID.'
    );
  }

  const prompt = m4_aiResolvePrompt_(ss, task);

  const outputText =
    m4_aiBuildDraftOutput_(
      task,
      prompt
    );

  const outputID =
    m4_createID_('AIOUTPUT');

  const outputSheet = ss.getSheetByName(
    M4_AI_WORKBENCH.SHEETS.OUTPUTS
  );

  m4_appendObject_(
    outputSheet,
    {
      OutputID: outputID,
      TaskID: task.TaskID,
      OutputText: outputText,
      OutputStatus: 'READY_FOR_REVIEW',
      ComplianceStatus:
        m4_boolean_(task.ComplianceRequired)
          ? 'PENDING'
          : 'NOT_REQUIRED',
      BrokerApproved: false,
      ComplianceApproved: false,
      CreatedAt: new Date(),
      UpdatedAt: new Date(),
      ApprovedAt: '',
      ApprovedBy: '',
      Notes:
        'Draft generated by AI Workbench rules engine.',
      AIWorkbenchVersion:
        M4_AI_WORKBENCH.VERSION
    }
  );

  m4_updateObject_(
    taskSheet,
    row,
    {
      Status: 'COMPLETED',
      OutputID: outputID,
      ErrorMessage: '',
      UpdatedAt: new Date(),
      UpdatedBy: m4_currentUser_(),
      AIWorkbenchVersion:
        M4_AI_WORKBENCH.VERSION
    }
  );

  return {
    success: true,
    taskID: task.TaskID,
    outputID
  };
}


function m4_aiResolvePrompt_(ss, task) {
  const promptSheet = ss.getSheetByName(
    M4_AI_WORKBENCH.SHEETS.PROMPTS
  );

  if (!promptSheet) {
    return {};
  }

  const prompts = m4_readObjects_(promptSheet);

  if (task.PromptID) {
    const byID = prompts.find(
      record =>
        String(record.PromptID || '') ===
        String(task.PromptID || '')
    );

    if (byID) {
      return byID;
    }
  }

  return (
    prompts.find(
      record =>
        String(record.TaskType || '') ===
        String(task.TaskType || '')
    ) || {}
  );
}


function m4_aiBuildDraftOutput_(task, prompt) {
  const instruction =
    String(
      task.PromptText ||
      prompt.PromptTemplate ||
      ''
    ).trim();

  const input =
    String(
      task.InputText || ''
    ).trim();

  return [
    `TASK TYPE: ${task.TaskType || 'OTHER'}`,
    `TONE: ${task.RequestedTone || prompt.DefaultTone || 'PROFESSIONAL'}`,
    `LENGTH: ${task.RequestedLength || prompt.DefaultLength || 'MEDIUM'}`,
    '',
    'INSTRUCTION:',
    instruction,
    '',
    'SOURCE CONTENT:',
    input,
    '',
    'STATUS:',
    'READY FOR AI GENERATION OR MANUAL REVIEW'
  ].join('\n');
}


/* =================================================================
   APPROVAL / ARCHIVE
================================================================= */

function approveSelectedAIWorkbenchTask() {
  return m4_aiUpdateSelectedOutput_(
    'APPROVED',
    true,
    true
  );
}


function archiveSelectedAIWorkbenchTask() {
  return m4_aiUpdateSelectedOutput_(
    'ARCHIVED',
    false,
    false
  );
}


function m4_aiUpdateSelectedOutput_(
  status,
  brokerApproved,
  complianceApproved
) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  if (!ss) {
    throw new Error(
      'Open the Command Center spreadsheet first.'
    );
  }

  const sheet = ss.getActiveSheet();

  if (
    sheet.getName() !==
    M4_AI_WORKBENCH.SHEETS.OUTPUTS
  ) {
    throw new Error(
      'Open AIOutputLibrary and select an output row.'
    );
  }

  const row = sheet.getActiveRange().getRow();

  if (row < 2) {
    throw new Error(
      'Select an output data row.'
    );
  }

  const record =
    m4_readRowObject_(sheet, row);

  if (!record.OutputID) {
    throw new Error(
      'The selected row does not contain an OutputID.'
    );
  }

  m4_updateObject_(
    sheet,
    row,
    {
      OutputStatus: status,
      ComplianceStatus:
        status === 'APPROVED'
          ? 'PASS'
          : record.ComplianceStatus,
      BrokerApproved:
        brokerApproved,
      ComplianceApproved:
        complianceApproved,
      UpdatedAt:
        new Date(),
      ApprovedAt:
        status === 'APPROVED'
          ? new Date()
          : record.ApprovedAt,
      ApprovedBy:
        status === 'APPROVED'
          ? m4_currentUser_()
          : record.ApprovedBy,
      AIWorkbenchVersion:
        M4_AI_WORKBENCH.VERSION
    }
  );

  return {
    success: true,
    outputID:
      record.OutputID,
    status
  };
}


/* =================================================================
   REFRESH
================================================================= */

function refreshMelroseAIWorkbench() {
  const ss = m4_getCommandCenter_();

  const taskSheet = ss.getSheetByName(
    M4_AI_WORKBENCH.SHEETS.TASKS
  );

  const outputSheet = ss.getSheetByName(
    M4_AI_WORKBENCH.SHEETS.OUTPUTS
  );

  const tasks = taskSheet
    ? m4_readObjects_(taskSheet)
    : [];

  const outputs = outputSheet
    ? m4_readObjects_(outputSheet)
    : [];

  return {
    success: true,
    tasks: tasks.length,
    outputs: outputs.length,
    newTasks:
      tasks.filter(
        record =>
          record.Status === 'NEW'
      ).length,
    approvedOutputs:
      outputs.filter(
        record =>
          record.OutputStatus ===
          'APPROVED'
      ).length
  };
}


/* =================================================================
   REGISTRATION
================================================================= */

function registerMelroseAIWorkbenchComponents() {
  if (
    typeof registerMelroseEngine ===
    'function'
  ) {
    registerMelroseEngine({
      componentKey:
        'ENGINE.AI_WORKBENCH_4',
      engineName:
        'AI Workbench 4',
      module:
        'AUTOMATION',
      version:
        M4_AI_WORKBENCH.VERSION,
      setupFunction:
        'setupMelroseAIWorkbench',
      requiredSheet:
        M4_AI_WORKBENCH.SHEETS.TASKS,
      required:
        true,
      description:
        'Central AI task, prompt, output and approval workflow.'
    });
  }

  if (
    typeof registerMelroseDependency ===
    'function'
  ) {
    [
      ['ENGINE.CORE_COMMON', true],
      ['ENGINE.CORE_SETTINGS', true],
      ['ENGINE.CORE_REGISTRY', true],
      ['ENGINE.COMPLIANCE_GATE', false]
    ].forEach(item => {
      registerMelroseDependency({
        source:
          'ENGINE.AI_WORKBENCH_4',
        type:
          'REQUIRES',
        target:
          item[0],
        required:
          item[1],
        notes:
          'AI Workbench dependency.'
      });
    });
  }

  return {
    success: true
  };
}


/* =================================================================
   NAVIGATION / TEST
================================================================= */

function openMelroseAIWorkbench() {
  const ss = m4_getCommandCenter_();

  const sheet = ss.getSheetByName(
    M4_AI_WORKBENCH.SHEETS.TASKS
  );

  if (!sheet) {
    throw new Error(
      'AIWorkbench does not exist.'
    );
  }

  ss.setActiveSheet(sheet);
  sheet.getRange('A1').activate();
}


function testMelroseAIWorkbench() {
  const ss = m4_getCommandCenter_();

  const tasks = Boolean(
    ss.getSheetByName(
      M4_AI_WORKBENCH.SHEETS.TASKS
    )
  );

  const prompts = Boolean(
    ss.getSheetByName(
      M4_AI_WORKBENCH.SHEETS.PROMPTS
    )
  );

  const outputs = Boolean(
    ss.getSheetByName(
      M4_AI_WORKBENCH.SHEETS.OUTPUTS
    )
  );

  return {
    success:
      tasks &&
      prompts &&
      outputs,
    version:
      M4_AI_WORKBENCH.VERSION,
    tasks,
    prompts,
    outputs
  };
}
