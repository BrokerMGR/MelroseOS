/**
 * ================================================================
 * MELROSEOS 4.0 — GRAPHIC RENDERER
 * Version 4.0.0
 *
 * Staged setup to avoid Spreadsheet service timeouts.
 *
 * Public functions:
 * - setupMelroseGraphicRendererStep1()
 * - setupMelroseGraphicRendererStep2()
 * - setupMelroseGraphicRendererFinalize()
 * - queueSelectedGraphicRender()
 * - refreshMelroseGraphicRenderer()
 * - approveSelectedRenderedGraphic()
 * - openMelroseGraphicRenderQueue()
 * - testMelroseGraphicRenderer()
 * ================================================================
 */

var M4_GRAPHIC_RENDERER = Object.freeze({
  VERSION: '4.0.0',
  MODULE: 'GRAPHIC_RENDERER',

  SHEETS: Object.freeze({
    RENDER_QUEUE: 'AdvertisingRenderQueue',
    RENDER_LOG: 'AdvertisingRenderLog'
  }),

  RENDER_STATUSES: Object.freeze([
    'QUEUED',
    'IN_PROGRESS',
    'READY_FOR_REVIEW',
    'APPROVED',
    'FAILED',
    'ARCHIVED'
  ]),

  OUTPUT_FORMATS: Object.freeze([
    'SQUARE_1080',
    'PORTRAIT_1080X1350',
    'STORY_1080X1920',
    'LANDSCAPE_1200X628'
  ])
});


/* =================================================================
   STAGED SETUP
================================================================= */

function setupMelroseGraphicRendererStep1() {
  const ss = m4_getCommandCenter_();

  m4_graphicEnsureSheetDirect_(
    ss,
    M4_GRAPHIC_RENDERER.SHEETS.RENDER_QUEUE,
    [
      'RenderID',
      'GraphicQueueID',
      'CreativeID',
      'CampaignID',
      'AssetID',
      'PromptMode',
      'PromptText',
      'OutputFormat',
      'CanvasWidth',
      'CanvasHeight',
      'LogoAssetID',
      'BusinessCardAssetID',
      'ComplianceFooter',
      'PeopleAllowed',
      'RenderStatus',
      'OutputFileID',
      'OutputURL',
      'BrokerApproved',
      'ComplianceApproved',
      'CreatedAt',
      'UpdatedAt',
      'Notes',
      'GraphicRendererVersion'
    ]
  );

  return {
    success: true,
    step: 1,
    nextFunction: 'setupMelroseGraphicRendererStep2'
  };
}


function setupMelroseGraphicRendererStep2() {
  const ss = m4_getCommandCenter_();

  m4_graphicEnsureSheetDirect_(
    ss,
    M4_GRAPHIC_RENDERER.SHEETS.RENDER_LOG,
    [
      'RenderLogID',
      'RenderID',
      'GraphicQueueID',
      'PreviousStatus',
      'NewStatus',
      'Action',
      'Message',
      'RecordedAt',
      'RecordedBy',
      'GraphicRendererVersion'
    ]
  );

  return {
    success: true,
    step: 2,
    nextFunction: 'setupMelroseGraphicRendererFinalize'
  };
}


function setupMelroseGraphicRendererFinalize() {
  try {
    m4_setSetting_(
      'GRAPHIC_RENDERER_VERSION',
      M4_GRAPHIC_RENDERER.VERSION,
      {
        type: 'STRING',
        category: 'MARKETING',
        description: 'Installed Graphic Renderer version.',
        required: true
      }
    );
  } catch (ignored) {}

  return {
    success: true,
    version: M4_GRAPHIC_RENDERER.VERSION,
    setupComplete: true
  };
}


function setupMelroseGraphicRenderer() {
  return setupMelroseGraphicRendererStep1();
}


/* =================================================================
   DIRECT SHEET CREATION
================================================================= */

function m4_graphicEnsureSheetDirect_(ss, sheetName, headers) {
  let sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    sheet = m4_graphicRetry_(
      () => ss.insertSheet(sheetName),
      `Create ${sheetName}`
    );

    m4_graphicRetry_(
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

  const range = m4_graphicRetry_(
    () => sheet.getRange(1, 1, 1, headers.length),
    `Open header range for ${sheetName}`
  );

  const current = m4_graphicRetry_(
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

  m4_graphicRetry_(
    () => range.setValues([repaired]),
    `Repair headers for ${sheetName}`
  );

  try {
    sheet.setFrozenRows(1);
  } catch (ignored) {}

  return sheet;
}


function m4_graphicRetry_(callback, operationName) {
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
   QUEUE RENDER
================================================================= */

function queueSelectedGraphicRender() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  if (!ss) {
    throw new Error('Open the Command Center spreadsheet first.');
  }

  const sourceSheet = ss.getActiveSheet();

  if (
    sourceSheet.getName() !==
    'AdvertisingGraphicQueue'
  ) {
    throw new Error(
      'Open AdvertisingGraphicQueue and select a queued graphic row.'
    );
  }

  const row = sourceSheet.getActiveRange().getRow();

  if (row < 2) {
    throw new Error('Select a graphic data row.');
  }

  const graphic = m4_readRowObject_(sourceSheet, row);

  if (!graphic.GraphicQueueID) {
    throw new Error(
      'The selected row does not contain a GraphicQueueID.'
    );
  }

  const renderSheet = ss.getSheetByName(
    M4_GRAPHIC_RENDERER.SHEETS.RENDER_QUEUE
  );

  if (!renderSheet) {
    throw new Error(
      'AdvertisingRenderQueue does not exist. Run setup steps first.'
    );
  }

  const existing = m4_findRow_(
    renderSheet,
    'GraphicQueueID',
    graphic.GraphicQueueID
  );

  if (existing) {
    return {
      success: true,
      created: false,
      renderID: m4_readRowObject_(
        renderSheet,
        existing
      ).RenderID
    };
  }

  const format =
    graphic.GraphicFormat ||
    'SQUARE_1080';

  const dimensions =
    m4_graphicDimensions_(format);

  const renderID =
    m4_createID_('RENDER');

  m4_appendObject_(
    renderSheet,
    {
      RenderID: renderID,
      GraphicQueueID:
        graphic.GraphicQueueID,
      CreativeID:
        graphic.CreativeID,
      CampaignID:
        graphic.CampaignID,
      AssetID:
        graphic.AssetID ||
        graphic.StoredAssetID ||
        '',
      PromptMode:
        graphic.PromptMode ||
        'GENERATED',
      PromptText:
        graphic.PromptText || '',
      OutputFormat:
        format,
      CanvasWidth:
        dimensions.width,
      CanvasHeight:
        dimensions.height,
      LogoAssetID:
        'BRAND-LOGO-MAIN',
      BusinessCardAssetID:
        'BRAND-BUSINESS-CARD-MAIN',
      ComplianceFooter:
        m4_getSetting_(
          'COMPLIANCE_FOOTER',
          'Licensed in Louisiana • (985) 250-0071 • Mandeville, LA'
        ),
      PeopleAllowed:
        false,
      RenderStatus:
        'QUEUED',
      OutputFileID:
        '',
      OutputURL:
        '',
      BrokerApproved:
        false,
      ComplianceApproved:
        false,
      CreatedAt:
        new Date(),
      UpdatedAt:
        new Date(),
      Notes:
        '',
      GraphicRendererVersion:
        M4_GRAPHIC_RENDERER.VERSION
    }
  );

  m4_updateObject_(
    sourceSheet,
    row,
    {
      GraphicStatus:
        'IN_PROGRESS',
      UpdatedAt:
        new Date(),
      AdvertisingFactoryVersion:
        graphic.AdvertisingFactoryVersion ||
        ''
    }
  );

  m4_graphicLog_(
    ss,
    {
      RenderID:
        renderID,
      GraphicQueueID:
        graphic.GraphicQueueID,
      PreviousStatus:
        '',
      NewStatus:
        'QUEUED',
      Action:
        'QUEUE_RENDER',
      Message:
        'Graphic render was queued.'
    }
  );

  return {
    success: true,
    created: true,
    renderID
  };
}


/* =================================================================
   REFRESH
================================================================= */

function refreshMelroseGraphicRenderer() {
  const ss = m4_getCommandCenter_();

  const renderSheet = ss.getSheetByName(
    M4_GRAPHIC_RENDERER.SHEETS.RENDER_QUEUE
  );

  if (!renderSheet) {
    throw new Error(
      'AdvertisingRenderQueue does not exist.'
    );
  }

  const records = m4_readObjects_(
    renderSheet,
    {
      includeRowNumber: true
    }
  );

  let queued = 0;
  let ready = 0;
  let failed = 0;

  records.forEach(record => {
    const status =
      String(
        record.RenderStatus || ''
      ).toUpperCase();

    if (status === 'QUEUED') {
      queued++;
    } else if (
      status === 'READY_FOR_REVIEW' ||
      status === 'APPROVED'
    ) {
      ready++;
    } else if (status === 'FAILED') {
      failed++;
    }
  });

  return {
    success: true,
    total:
      records.length,
    queued,
    ready,
    failed
  };
}


/* =================================================================
   APPROVAL
================================================================= */

function approveSelectedRenderedGraphic() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  if (!ss) {
    throw new Error('Open the Command Center spreadsheet first.');
  }

  const sheet = ss.getActiveSheet();

  if (
    sheet.getName() !==
    M4_GRAPHIC_RENDERER.SHEETS.RENDER_QUEUE
  ) {
    throw new Error(
      'Open AdvertisingRenderQueue and select a render row.'
    );
  }

  const row = sheet.getActiveRange().getRow();

  if (row < 2) {
    throw new Error('Select a render data row.');
  }

  const record =
    m4_readRowObject_(sheet, row);

  if (!record.RenderID) {
    throw new Error(
      'The selected row does not contain a RenderID.'
    );
  }

  const previousStatus =
    record.RenderStatus || '';

  m4_updateObject_(
    sheet,
    row,
    {
      RenderStatus:
        'APPROVED',
      BrokerApproved:
        true,
      ComplianceApproved:
        true,
      UpdatedAt:
        new Date(),
      GraphicRendererVersion:
        M4_GRAPHIC_RENDERER.VERSION
    }
  );

  m4_graphicLog_(
    ss,
    {
      RenderID:
        record.RenderID,
      GraphicQueueID:
        record.GraphicQueueID,
      PreviousStatus:
        previousStatus,
      NewStatus:
        'APPROVED',
      Action:
        'APPROVE_RENDER',
      Message:
        'Rendered graphic approved.'
    }
  );

  return {
    success: true,
    renderID:
      record.RenderID
  };
}


/* =================================================================
   HELPERS
================================================================= */

function m4_graphicDimensions_(format) {
  const normalized =
    String(format || '').toUpperCase();

  switch (normalized) {
    case 'PORTRAIT_1080X1350':
      return {
        width: 1080,
        height: 1350
      };

    case 'STORY_1080X1920':
      return {
        width: 1080,
        height: 1920
      };

    case 'LANDSCAPE_1200X628':
      return {
        width: 1200,
        height: 628
      };

    default:
      return {
        width: 1080,
        height: 1080
      };
  }
}


function m4_graphicLog_(ss, entry) {
  const sheet = ss.getSheetByName(
    M4_GRAPHIC_RENDERER.SHEETS.RENDER_LOG
  );

  if (!sheet) {
    return;
  }

  m4_appendObject_(
    sheet,
    {
      RenderLogID:
        m4_createID_('RENDERLOG'),
      RenderID:
        entry.RenderID || '',
      GraphicQueueID:
        entry.GraphicQueueID || '',
      PreviousStatus:
        entry.PreviousStatus || '',
      NewStatus:
        entry.NewStatus || '',
      Action:
        entry.Action || '',
      Message:
        entry.Message || '',
      RecordedAt:
        new Date(),
      RecordedBy:
        m4_currentUser_(),
      GraphicRendererVersion:
        M4_GRAPHIC_RENDERER.VERSION
    }
  );
}


/* =================================================================
   REGISTRATION
================================================================= */

function registerMelroseGraphicRendererComponents() {
  if (
    typeof registerMelroseEngine ===
    'function'
  ) {
    registerMelroseEngine({
      componentKey:
        'ENGINE.GRAPHIC_RENDERER',
      engineName:
        'Graphic Renderer',
      module:
        'MARKETING',
      version:
        M4_GRAPHIC_RENDERER.VERSION,
      setupFunction:
        'setupMelroseGraphicRenderer',
      requiredSheet:
        M4_GRAPHIC_RENDERER.SHEETS.RENDER_QUEUE,
      required:
        true,
      description:
        'Coordinates advertising graphic render requests and approvals.'
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
      ['ENGINE.BRAND_LIBRARY', true],
      ['ENGINE.ASSET_LIBRARY', true],
      ['ENGINE.CAMPAIGN_BUILDER', true],
      ['ENGINE.ADVERTISING_FACTORY_4', true]
    ].forEach(item => {
      registerMelroseDependency({
        source:
          'ENGINE.GRAPHIC_RENDERER',
        type:
          'REQUIRES',
        target:
          item[0],
        required:
          item[1],
        notes:
          'Graphic Renderer dependency.'
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

function openMelroseGraphicRenderQueue() {
  const ss = m4_getCommandCenter_();

  const sheet = ss.getSheetByName(
    M4_GRAPHIC_RENDERER.SHEETS.RENDER_QUEUE
  );

  if (!sheet) {
    throw new Error(
      'AdvertisingRenderQueue does not exist.'
    );
  }

  ss.setActiveSheet(sheet);
  sheet.getRange('A1').activate();
}


function testMelroseGraphicRenderer() {
  const ss = m4_getCommandCenter_();

  const renderQueue = Boolean(
    ss.getSheetByName(
      M4_GRAPHIC_RENDERER.SHEETS.RENDER_QUEUE
    )
  );

  const renderLog = Boolean(
    ss.getSheetByName(
      M4_GRAPHIC_RENDERER.SHEETS.RENDER_LOG
    )
  );

  return {
    success:
      renderQueue &&
      renderLog,
    version:
      M4_GRAPHIC_RENDERER.VERSION,
    renderQueue,
    renderLog
  };
}
