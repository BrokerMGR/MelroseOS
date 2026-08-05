/**
 * =====================================================================
 * MELROSEOS 4.2 — DISTRIBUTED INSTALLER
 * Full Overwrite
 * Version 4.2.0
 *
 * PURPOSE
 * - Uses the six existing MelroseOS workbooks.
 * - Uses the existing legacy Apps Script project as the source package.
 * - Creates/validates bound Apps Script projects.
 * - Inventories and routes source files by workbook.
 * - Deploys code packages one workbook at a time.
 * - Builds required workbook sheets.
 * - Builds and processes the data migration queue.
 * - Produces deployment, validation, cleanup, and bootstrap reports.
 *
 * IMPORTANT PLATFORM LIMITATION
 * Google does not provide a direct Apps Script API endpoint that creates
 * installable triggers inside another Apps Script project. This installer
 * deploys a Bootstrap file into every destination project. After deployment,
 * run installMelroseWorkbookBootstrap() one time inside each destination
 * Apps Script project to authorize and install that workbook's triggers.
 *
 * REQUIRED OAUTH SCOPES IN THIS INSTALLER PROJECT'S appsscript.json
 * - https://www.googleapis.com/auth/spreadsheets
 * - https://www.googleapis.com/auth/drive
 * - https://www.googleapis.com/auth/script.projects
 * - https://www.googleapis.com/auth/script.external_request
 * - https://www.googleapis.com/auth/script.scriptapp
 *
 * REQUIRED GOOGLE CLOUD API
 * - Google Apps Script API
 *
 * INSTALLER RUN ORDER
 * 1. melroseInstallerSetup()
 * 2. melroseInstallerPreflight()
 * 3. melroseInstallerCreateBoundProjects()
 * 4. melroseInstallerInventoryLegacyProject()
 * 5. melroseInstallerBuildDeploymentQueue()
 * 6. melroseInstallerInstallCodeTrigger()
 * 7. melroseInstallerInstallStructureTrigger()
 * 8. melroseInstallerBuildMigrationQueue()
 * 9. melroseInstallerInstallMigrationTrigger()
 * 10. melroseInstallerRunValidation()
 *
 * MASTER STATUS
 * - melroseInstallerStatus()
 *
 * NO SOURCE DATA OR LEGACY FILES ARE DELETED BY THIS INSTALLER.
 * =====================================================================
 */

var M4_INSTALLER = Object.freeze({
  VERSION: '4.2.0',
  MODULE: 'SYSTEM',

  LEGACY: Object.freeze({
    spreadsheetId:
      '19hd0-ICZrsaczBS58R7nPyVbJrZkg_vprF5foIIPgPw',
    scriptId:
      '1KWC2aWey5AIP2u-z9y1hH5pJbXuKSN6mcbT5hXRg-Grwqc_HrfcvIyZs'
  }),

  WORKBOOKS: Object.freeze({
    CORE: Object.freeze({
      name: 'MelroseOS Core',
      spreadsheetId:
        '1W-32zYjyttQQS81UnvzJFz9yhp58YUKpTM0Kw0bfK64'
    }),
    CRM: Object.freeze({
      name: 'MelroseOS CRM',
      spreadsheetId:
        '1QpgjJEMpW4wW_xNUY7S3EQh4yqvU8P1y2eNZ4oJlOq8'
    }),
    MARKETING: Object.freeze({
      name: 'MelroseOS Marketing',
      spreadsheetId:
        '1MnWLm3aK1D8KDmqNnkcsUmiBnFyjKlQcOtVwbeaMldo'
    }),
    WEBSITE: Object.freeze({
      name: 'MelroseOS Website',
      spreadsheetId:
        '1Ml9wEEz_gi30i8Js3iMJeycYy_nnrVv6KYD22g9aVhc'
    }),
    ANALYTICS: Object.freeze({
      name: 'MelroseOS Analytics',
      spreadsheetId:
        '1OMqOY9trsL0r46BY0tg023mpq9i3SpbX3kNSnMvZsPU'
    }),
    ARCHIVE: Object.freeze({
      name: 'MelroseOS Archive',
      spreadsheetId:
        '1uRai34TuOVNKKZ2TJKXkfaw03bd8uqlD8RQTALXv2lk'
    })
  }),

  API_ROOT: 'https://script.googleapis.com/v1/projects',

  CONTROL_SHEETS: Object.freeze({
    WORKBOOKS: 'Installer_Workbooks',
    PROJECTS: 'Installer_ScriptProjects',
    SOURCE_FILES: 'Installer_SourceFiles',
    CODE_QUEUE: 'Installer_CodeQueue',
    STRUCTURE_QUEUE: 'Installer_StructureQueue',
    MIGRATION_QUEUE: 'Installer_MigrationQueue',
    VALIDATION: 'Installer_Validation',
    CLEANUP: 'Installer_CleanupCandidates',
    LOG: 'Installer_Log',
    STATUS: 'Installer_Status'
  }),

  PACKAGE_RULES: Object.freeze({
    CORE: Object.freeze([
      /^Core_/i,
      /^MelroseOS_FinalIntegration$/i,
      /^Launch_Audit$/i,
      /^Engine_CommandCenter$/i,
      /^Engine_TaskScheduler$/i,
      /^Engine_WorkflowAutomation$/i,
      /^Engine_SystemMonitor$/i,
      /^MelroseOS_DeploymentBuilder/i,
      /^MelroseOS_ScriptDeployer/i,
      /^MelroseOS_DistributedMigration/i
    ]),
    CRM: Object.freeze([
      /^Core_Common$/i,
      /^Core_Settings$/i,
      /^Engine_CRM$/i,
      /^Engine_LeadRouter$/i
    ]),
    MARKETING: Object.freeze([
      /^Core_Common$/i,
      /^Core_Settings$/i,
      /^Engine_BrandLibrary$/i,
      /^Engine_AssetLibrary/i,
      /^Engine_CampaignBuilder/i,
      /^Engine_AdvertisingFactory/i,
      /^Engine_GraphicRenderer$/i,
      /^Engine_AIWorkbench$/i,
      /^Engine_SocialPublisher$/i,
      /^Engine_EmailAutomation$/i,
      /^Engine_NotificationCenter$/i
    ]),
    WEBSITE: Object.freeze([
      /^Core_Common$/i,
      /^Core_Settings$/i,
      /^Engine_WebsiteSync$/i,
      /^Engine_APIHub$/i
    ]),
    ANALYTICS: Object.freeze([
      /^Core_Common$/i,
      /^Core_Settings$/i,
      /^Engine_BrokerDashboard$/i,
      /^Engine_Analytics$/i,
      /^Engine_ReportBuilder$/i,
      /^Engine_DocumentGenerator$/i
    ]),
    ARCHIVE: Object.freeze([
      /^Core_Common$/i,
      /^Core_Settings$/i,
      /^Core_Backup$/i,
      /^Engine_BackupManager$/i,
      /^Core_UpgradeManager$/i
    ])
  }),

  SHEET_PACKAGES: Object.freeze({
    CORE: Object.freeze([
      ['MelroseOS_Settings', [
        'SettingKey','SettingValue','SettingType','Category',
        'Description','Required','UpdatedAt','UpdatedBy'
      ]],
      ['MelroseOS_Registry', [
        'RegistryID','ComponentName','ComponentType','Module',
        'Version','Status','SpreadsheetID','SheetName',
        'ScriptProjectID','Dependencies','InstalledAt',
        'UpdatedAt','Notes'
      ]],
      ['MelroseOS_RegistryHistory', [
        'HistoryID','RegistryID','Action','OldVersion',
        'NewVersion','Status','Message','RecordedAt','RecordedBy'
      ]],
      ['MelroseOS_Dependencies', [
        'DependencyID','ComponentName','DependsOn',
        'RequiredVersion','Status','CheckedAt','Notes'
      ]],
      ['MelroseOS_ActivityLog', [
        'ActivityID','Module','Action','Status','Message',
        'ReferenceID','RecordedAt','RecordedBy'
      ]],
      ['MelroseOS_ErrorLog', [
        'ErrorID','Module','FunctionName','ErrorMessage',
        'StackTrace','ReferenceID','OccurredAt','Resolved',
        'ResolvedAt','Resolution'
      ]],
      ['MelroseOS_Health', [
        'HealthID','ComponentName','Module','Status',
        'LastCheckedAt','LastSuccessAt','FailureCount',
        'Message','Version'
      ]],
      ['MelroseOS_CommandCenter', [
        'CommandID','CommandName','Module','FunctionName',
        'Description','Enabled','SortOrder','LastRunAt',
        'LastStatus','LastMessage'
      ]],
      ['MelroseOS_ComponentStatus', [
        'ComponentName','Module','Version','Status',
        'SpreadsheetID','ScriptProjectID','LastCheckedAt','Message'
      ]],
      ['ScheduledTasks', [
        'TaskID','TaskName','Module','HandlerFunction',
        'ScheduleType','ScheduleValue','Enabled','LastRunAt',
        'NextRunAt','LastStatus','LastMessage'
      ]],
      ['SystemEvents', [
        'EventID','EventType','Module','Severity',
        'Message','ReferenceID','RecordedAt','Acknowledged'
      ]],
      ['SystemAlerts', [
        'AlertID','AlertType','Module','Severity',
        'Title','Message','Status','CreatedAt','ResolvedAt'
      ]],
      ['WorkflowDefinitions', [
        'WorkflowID','WorkflowName','Module','TriggerType',
        'TriggerValue','HandlerFunction','Enabled','Priority',
        'CreatedAt','UpdatedAt'
      ]],
      ['WorkflowQueue', [
        'QueueID','WorkflowID','ReferenceID','PayloadJSON',
        'Status','AttemptCount','ScheduledAt','StartedAt',
        'CompletedAt','ErrorMessage'
      ]]
    ]),

    CRM: Object.freeze([
      ['CRM_Contacts', [
        'ContactID','ContactType','FirstName','LastName',
        'Email','Phone','City','Parish','State','ZipCode',
        'LeadSource','AssignedAgentEmail','Status','Tags',
        'CreatedAt','UpdatedAt'
      ]],
      ['CRM_Leads', [
        'LeadID','LeadType','FirstName','LastName','Email',
        'Phone','City','Parish','PriceRange','Timeline',
        'LeadSource','AssignedAgentEmail','AssignmentStatus',
        'LeadStatus','CreatedAt','UpdatedAt'
      ]],
      ['CRM_Activities', [
        'ActivityID','ContactID','LeadID','ActivityType',
        'Subject','Details','AssignedTo','DueAt','CompletedAt',
        'Status','CreatedAt'
      ]],
      ['LeadRoutingQueue', [
        'RoutingID','LeadID','LeadType','Parish','LeadEmail',
        'LeadPhone','AssignedAgentEmail','RoutingStatus',
        'AttemptCount','CreatedAt','ProcessedAt','ErrorMessage'
      ]],
      ['LeadRoutingAgentRules', [
        'RuleID','AgentEmail','AgentName','LeadType','Parish',
        'Priority','DailyLimit','Enabled','LastAssignedAt',
        'AssignmentCount'
      ]],
      ['LeadRoutingLog', [
        'LogID','RoutingID','LeadID','AgentEmail',
        'Action','Status','Message','RecordedAt'
      ]],
      ['AgentConfig', [
        'AgentID','AgentName','AgentEmail','Phone','Parishes',
        'LeadTypes','Priority','DailyLimit','Active',
        'LastAssignedAt','AssignmentCount','UpdatedAt'
      ]],
      ['Agents', [
        'AgentID','FirstName','LastName','DisplayName',
        'Email','Phone','LicenseNumber','Title','Specialties',
        'ServiceAreas','PhotoURL','Bio','Active','SortOrder',
        'UpdatedAt'
      ]]
    ]),

    MARKETING: Object.freeze([
      ['AdvertisingBrandLibrary', [
        'BrandID','BrandName','LogoURL','PrimaryColor',
        'SecondaryColor','AccentColor','FontHeading',
        'FontBody','ComplianceFooter','Active','UpdatedAt'
      ]],
      ['AdvertisingBrandColors', [
        'ColorID','BrandID','ColorName','HexValue',
        'UsageRule','Active','UpdatedAt'
      ]],
      ['AdvertisingBrandRules', [
        'RuleID','BrandID','RuleType','RuleName',
        'RuleValue','Required','Active','UpdatedAt'
      ]],
      ['AdvertisingAssetLibrary', [
        'AssetID','AssetType','AssetName','FileURL','DriveFileID',
        'Category','Tags','CampaignID','Status','CreatedAt','UpdatedAt'
      ]],
      ['AdvertisingCampaigns', [
        'CampaignID','CampaignName','CampaignType','Audience',
        'Offer','StartDate','EndDate','Status','Budget',
        'PrimaryCTA','LandingPageURL','CreatedAt','UpdatedAt'
      ]],
      ['AdvertisingCreativeQueue', [
        'CreativeID','CampaignID','CreativeType','Headline',
        'BodyCopy','CTA','ImagePrompt','AssetID','Status',
        'CreatedAt','UpdatedAt'
      ]],
      ['AdvertisingGraphicQueue', [
        'GraphicID','CampaignID','PostID','RequiredFileName',
        'Category','Audience','Headline','CreativeTheme',
        'Prompt','Status','AssetURL','CreatedAt','UpdatedAt'
      ]],
      ['AdvertisingPublishQueue', [
        'PublishID','CampaignID','AssetID','Platform',
        'AccountName','Caption','DestinationURL','ScheduledAt',
        'Status','PublishedAt','ExternalPostID','ErrorMessage'
      ]],
      ['AdvertisingRenderQueue', [
        'RenderID','GraphicID','AssetType','Prompt',
        'SourceAssetURL','OutputFileName','Status',
        'AttemptCount','CreatedAt','CompletedAt','ErrorMessage'
      ]],
      ['AIWorkbench', [
        'RequestID','Module','RequestType','Prompt',
        'InputJSON','Status','OutputText','OutputJSON',
        'CreatedAt','CompletedAt','ErrorMessage'
      ]],
      ['AIPromptLibrary', [
        'PromptID','PromptName','Module','PromptType',
        'PromptTemplate','Variables','Active','Version','UpdatedAt'
      ]],
      ['AIOutputLibrary', [
        'OutputID','RequestID','Module','OutputType',
        'OutputText','OutputURL','Approved','CreatedAt'
      ]],
      ['SocialPublishQueue', [
        'SocialID','CampaignID','Platform','AccountName',
        'AssetURL','Caption','DestinationURL','ScheduledAt',
        'Status','PublishedAt','ExternalPostID','ErrorMessage'
      ]],
      ['EmailQueue', [
        'EmailID','CampaignID','RecipientEmail','RecipientName',
        'Subject','BodyHTML','ReplyTo','BCC','ScheduledAt',
        'Status','SentAt','MessageID','ErrorMessage'
      ]],
      ['EmailTemplates', [
        'TemplateID','TemplateName','Module','SubjectTemplate',
        'BodyHTML','Variables','Active','Version','UpdatedAt'
      ]],
      ['NotificationQueue', [
        'NotificationID','NotificationType','Recipient',
        'Subject','Message','ReferenceID','ScheduledAt',
        'Status','SentAt','ErrorMessage'
      ]]
    ]),

    WEBSITE: Object.freeze([
      ['WebsiteSyncJobs', [
        'JobID','JobType','SourceSheet','DestinationEndpoint',
        'PayloadMapping','Status','AttemptCount','ScheduledAt',
        'StartedAt','CompletedAt','ErrorMessage'
      ]],
      ['WebsiteSyncMappings', [
        'MappingID','JobType','SourceField','DestinationField',
        'TransformRule','Required','Active','UpdatedAt'
      ]],
      ['WebsiteSyncLog', [
        'LogID','JobID','Action','Status','HTTPStatus',
        'Message','RecordedAt'
      ]],
      ['APIEndpoints', [
        'EndpointID','EndpointName','Module','BaseURL',
        'Method','AuthenticationType','CredentialSettingKey',
        'Active','UpdatedAt'
      ]],
      ['APIRequests', [
        'RequestID','EndpointID','Method','RequestURL',
        'HeadersJSON','PayloadJSON','Status','AttemptCount',
        'ScheduledAt','CompletedAt','ResponseCode','ResponseBody',
        'ErrorMessage'
      ]],
      ['APILog', [
        'LogID','RequestID','EndpointID','Status',
        'ResponseCode','Message','RecordedAt'
      ]]
    ]),

    ANALYTICS: Object.freeze([
      ['BrokerDashboard', [
        'MetricID','MetricName','MetricCategory','MetricValue',
        'TargetValue','PeriodStart','PeriodEnd','Status',
        'CalculatedAt'
      ]],
      ['BrokerMetrics', [
        'MetricID','MetricName','MetricType','SourceWorkbook',
        'SourceSheet','CalculationRule','CurrentValue',
        'PriorValue','Variance','UpdatedAt'
      ]],
      ['AnalyticsMetrics', [
        'MetricID','MetricName','Module','MetricType',
        'CalculationRule','Active','UpdatedAt'
      ]],
      ['AnalyticsSnapshots', [
        'SnapshotID','MetricID','MetricValue','PeriodStart',
        'PeriodEnd','RecordedAt'
      ]],
      ['ReportDefinitions', [
        'ReportID','ReportName','Module','ReportType',
        'SourceWorkbook','SourceSheet','FilterJSON',
        'OutputType','Schedule','Active','UpdatedAt'
      ]],
      ['ReportQueue', [
        'QueueID','ReportID','RequestedBy','ParametersJSON',
        'Status','ScheduledAt','StartedAt','CompletedAt',
        'OutputURL','ErrorMessage'
      ]],
      ['DocumentTemplates', [
        'TemplateID','TemplateName','Module','TemplateType',
        'TemplateFileID','OutputFolderID','MergeFields',
        'Active','UpdatedAt'
      ]],
      ['DocumentQueue', [
        'DocumentID','TemplateID','ReferenceID','MergeDataJSON',
        'Status','ScheduledAt','StartedAt','CompletedAt',
        'OutputFileID','OutputURL','ErrorMessage'
      ]]
    ]),

    ARCHIVE: Object.freeze([
      ['BackupJobs', [
        'BackupJobID','WorkbookKey','SpreadsheetID',
        'BackupType','Schedule','RetentionDays','Enabled',
        'LastRunAt','LastStatus','LastMessage'
      ]],
      ['BackupHistory', [
        'BackupID','BackupJobID','WorkbookKey','SourceSpreadsheetID',
        'BackupFileID','BackupURL','StartedAt','CompletedAt',
        'Status','SizeBytes','ErrorMessage'
      ]],
      ['BackupConfig', [
        'ConfigKey','ConfigValue','Description','UpdatedAt'
      ]],
      ['MelroseOS_BackupLog', [
        'BackupID','BackupType','SourceID','DestinationID',
        'Status','Message','CreatedAt'
      ]],
      ['MelroseOS_UpgradeHistory', [
        'UpgradeID','ComponentName','OldVersion','NewVersion',
        'Status','StartedAt','CompletedAt','Message'
      ]],
      ['MelroseOS_UpgradeQueue', [
        'QueueID','ComponentName','TargetVersion','Status',
        'AttemptCount','ScheduledAt','StartedAt','CompletedAt',
        'ErrorMessage'
      ]],
      ['LaunchAuditChecks', [
        'CheckID','CheckName','Module','Severity',
        'HandlerFunction','ExpectedResult','Enabled'
      ]],
      ['LaunchAuditResults', [
        'ResultID','CheckID','Status','ActualResult',
        'Message','CheckedAt'
      ]]
    ])
  }),

  MIGRATION_ROUTING: Object.freeze({
    CORE: Object.freeze([
      'MelroseOS_Settings','MelroseOS_Registry',
      'MelroseOS_RegistryHistory','MelroseOS_Dependencies',
      'MelroseOS_ActivityLog','MelroseOS_ErrorLog',
      'MelroseOS_Health','MelroseOS_HealthDashboard',
      'MelroseOS_HealthHistory','Architecture_Overview',
      'Architecture_Health','MelroseOS_InstallHistory',
      'MelroseOS_InstallReport','MelroseOS_MenuRegistry',
      'MelroseOS_CommandCenter','MelroseOS_ComponentStatus',
      'MelroseOS_ActionQueue','MelroseOS_IntegrationStatus',
      'MelroseOS_IntegrationAudit','MelroseOS_FinalMenu',
      'SystemHealth','SystemEvents','SystemAlerts',
      'ScheduledTasks','TaskExecutions','TaskCalendar',
      'WorkflowDefinitions','WorkflowQueue','WorkflowHistory'
    ]),
    CRM: Object.freeze([
      'CRM_Contacts','CRM_Leads','CRM_Activities',
      'LeadRoutingQueue','LeadRoutingAgentRules',
      'LeadRoutingLog','AgentConfig','Agents','AgentRoster'
    ]),
    MARKETING: Object.freeze([
      'AdvertisingBrandLibrary','AdvertisingBrandColors',
      'AdvertisingBrandRules','AdvertisingAssetLibrary',
      'AdvertisingCollections','AdvertisingTags',
      'AdvertisingAssetUsage','AdvertisingCampaigns',
      'AdvertisingCreativeQueue','AdvertisingAudiences',
      'AdvertisingOffers','AdvertisingGraphicQueue',
      'AdvertisingReviewLog','AdvertisingPublishQueue',
      'AdvertisingRenderQueue','AdvertisingRenderLog',
      'AIWorkbench','AIPromptLibrary','AIOutputLibrary',
      'SocialPublishQueue','SocialPublishHistory',
      'EmailQueue','EmailTemplates','EmailHistory',
      'NotificationQueue','NotificationTemplates',
      'NotificationHistory'
    ]),
    WEBSITE: Object.freeze([
      'WebsiteSyncJobs','WebsiteSyncMappings','WebsiteSyncLog',
      'APIEndpoints','APIRequests','APILog'
    ]),
    ANALYTICS: Object.freeze([
      'BrokerDashboard','BrokerMetrics','AnalyticsMetrics',
      'AnalyticsSnapshots','AnalyticsDashboard',
      'ReportDefinitions','ReportQueue','ReportArchive',
      'DocumentTemplates','DocumentQueue','DocumentArchive'
    ]),
    ARCHIVE: Object.freeze([
      'BackupJobs','BackupHistory','BackupConfig',
      'MelroseOS_BackupLog','MelroseOS_BackupConfig',
      'MelroseOS_UpgradeHistory','MelroseOS_UpgradeQueue',
      'LaunchAuditChecks','LaunchAuditResults','LaunchAuditSummary'
    ])
  }),

  BOOTSTRAP_TRIGGERS: Object.freeze({
    CORE: Object.freeze([
      ['runHealthMonitor', 'MINUTES', 15],
      ['processWorkflowQueue', 'MINUTES', 5],
      ['processScheduledTasks', 'MINUTES', 5]
    ]),
    CRM: Object.freeze([
      ['processLeadRoutingQueue', 'MINUTES', 5]
    ]),
    MARKETING: Object.freeze([
      ['processAdvertisingRenderQueue', 'MINUTES', 5],
      ['processSocialPublishQueue', 'MINUTES', 5],
      ['processEmailQueue', 'MINUTES', 5],
      ['processNotificationQueue', 'MINUTES', 5]
    ]),
    WEBSITE: Object.freeze([
      ['processWebsiteSyncQueue', 'MINUTES', 5],
      ['processAPIRequestQueue', 'MINUTES', 5]
    ]),
    ANALYTICS: Object.freeze([
      ['processReportQueue', 'MINUTES', 15],
      ['processDocumentQueue', 'MINUTES', 15]
    ]),
    ARCHIVE: Object.freeze([
      ['runScheduledBackups', 'HOURS', 6]
    ])
  })
});


/* =====================================================================
   PUBLIC INSTALLER FUNCTIONS
===================================================================== */

function melroseInstallerSetup() {
  var core = m4iOpenWorkbook_('CORE');

  var definitions = [
    [M4_INSTALLER.CONTROL_SHEETS.WORKBOOKS, [
      'WorkbookKey','WorkbookName','SpreadsheetID','SpreadsheetURL',
      'AccessStatus','CellCount','SheetCount','LastCheckedAt','Version'
    ]],
    [M4_INSTALLER.CONTROL_SHEETS.PROJECTS, [
      'WorkbookKey','WorkbookName','SpreadsheetID','ScriptProjectID',
      'ProjectStatus','LastDeployedAt','LastVerifiedAt',
      'ErrorMessage','Version'
    ]],
    [M4_INSTALLER.CONTROL_SHEETS.SOURCE_FILES, [
      'FileID','SourceFileName','SourceFileType','CORE','CRM',
      'MARKETING','WEBSITE','ANALYTICS','ARCHIVE',
      'DetectedAt','Version'
    ]],
    [M4_INSTALLER.CONTROL_SHEETS.CODE_QUEUE, [
      'QueueID','WorkbookKey','SpreadsheetID','ScriptProjectID',
      'Status','AttemptCount','StartedAt','CompletedAt',
      'FilesDeployed','ErrorMessage','UpdatedAt','Version'
    ]],
    [M4_INSTALLER.CONTROL_SHEETS.STRUCTURE_QUEUE, [
      'QueueID','WorkbookKey','SpreadsheetID','SheetName',
      'Status','AttemptCount','StartedAt','CompletedAt',
      'ErrorMessage','UpdatedAt','Version'
    ]],
    [M4_INSTALLER.CONTROL_SHEETS.MIGRATION_QUEUE, [
      'MigrationID','SourceSpreadsheetID','SourceSheetName',
      'DestinationWorkbookKey','DestinationSpreadsheetID',
      'DestinationSheetName','Status','AttemptCount',
      'StartedAt','CompletedAt','SourceLastRow',
      'SourceLastColumn','DestinationLastRow',
      'DestinationLastColumn','Verified','ErrorMessage',
      'UpdatedAt','Version'
    ]],
    [M4_INSTALLER.CONTROL_SHEETS.VALIDATION, [
      'ValidationID','WorkbookKey','ValidationType',
      'TargetName','Status','ExpectedValue','ActualValue',
      'Message','CheckedAt','Version'
    ]],
    [M4_INSTALLER.CONTROL_SHEETS.CLEANUP, [
      'CandidateID','CandidateType','SourceName','Reason',
      'RecommendedAction','SafeToDelete','Reviewed',
      'ReviewedAt','Notes','Version'
    ]],
    [M4_INSTALLER.CONTROL_SHEETS.LOG, [
      'LogID','Stage','WorkbookKey','Action','Status',
      'Message','RecordedAt','RecordedBy','Version'
    ]],
    [M4_INSTALLER.CONTROL_SHEETS.STATUS, [
      'Stage','Status','TotalItems','CompletedItems',
      'WarningItems','FailedItems','LastUpdatedAt','Message'
    ]]
  ];

  definitions.forEach(function (definition) {
    m4iEnsureSheet_(core, definition[0], definition[1]);
  });

  m4iSeedWorkbookRegistry_();
  m4iSeedScriptProjectRegistry_();
  m4iWriteDistributedSettings_();

  PropertiesService.getScriptProperties().setProperties({
    MELROSEOS_INSTALLER_VERSION: M4_INSTALLER.VERSION,
    MELROSEOS_LEGACY_SPREADSHEET_ID: M4_INSTALLER.LEGACY.spreadsheetId,
    MELROSEOS_LEGACY_SCRIPT_ID: M4_INSTALLER.LEGACY.scriptId,
    M4_COMMAND_CENTER_SPREADSHEET_ID:
      M4_INSTALLER.WORKBOOKS.CORE.spreadsheetId
  }, false);

  m4iLog_(core, 'SETUP', 'CORE', 'CREATE_CONTROL_CENTER',
    'SUCCESS', 'Installer control center created.');

  return {
    success: true,
    version: M4_INSTALLER.VERSION,
    nextFunction: 'melroseInstallerPreflight'
  };
}


function melroseInstallerPreflight() {
  var core = m4iOpenWorkbook_('CORE');
  var workbookSheet = core.getSheetByName(
    M4_INSTALLER.CONTROL_SHEETS.WORKBOOKS
  );

  var results = [];
  var failures = 0;

  Object.keys(M4_INSTALLER.WORKBOOKS).forEach(function (key) {
    var definition = M4_INSTALLER.WORKBOOKS[key];

    try {
      var workbook = SpreadsheetApp.openById(definition.spreadsheetId);
      var cellCount = m4iWorkbookCellCount_(workbook);

      results.push({
        WorkbookKey: key,
        WorkbookName: definition.name,
        SpreadsheetID: definition.spreadsheetId,
        SpreadsheetURL: workbook.getUrl(),
        AccessStatus: 'PASS',
        CellCount: cellCount,
        SheetCount: workbook.getSheets().length,
        LastCheckedAt: new Date(),
        Version: M4_INSTALLER.VERSION
      });
    } catch (error) {
      failures++;

      results.push({
        WorkbookKey: key,
        WorkbookName: definition.name,
        SpreadsheetID: definition.spreadsheetId,
        SpreadsheetURL: '',
        AccessStatus: 'FAIL',
        CellCount: '',
        SheetCount: '',
        LastCheckedAt: new Date(),
        Version: M4_INSTALLER.VERSION
      });

      m4iLog_(core, 'PREFLIGHT', key, 'OPEN_WORKBOOK',
        'FAILED', error.message || String(error));
    }
  });

  try {
    m4iGetProjectContent_(M4_INSTALLER.LEGACY.scriptId);
  } catch (error) {
    failures++;
    m4iLog_(core, 'PREFLIGHT', 'LEGACY', 'READ_SOURCE_SCRIPT',
      'FAILED', error.message || String(error));
  }

  m4iUpsertBatch_(workbookSheet, 'WorkbookKey', results);
  m4iUpdateStageStatus_(core, 'PREFLIGHT',
    failures ? 'FAILED' : 'COMPLETE',
    results.length + 1,
    results.length + 1 - failures,
    0,
    failures,
    failures ? 'Resolve failed access checks.' : 'All access checks passed.');

  return {
    success: failures === 0,
    failures: failures,
    workbooksChecked: results.length,
    nextFunction: failures ? '' : 'melroseInstallerCreateBoundProjects'
  };
}


function melroseInstallerCreateBoundProjects() {
  var core = m4iOpenWorkbook_('CORE');
  var sheet = core.getSheetByName(
    M4_INSTALLER.CONTROL_SHEETS.PROJECTS
  );

  var rows = m4iReadObjects_(sheet, true);
  var created = 0;
  var verified = 0;
  var failed = 0;

  rows.forEach(function (row) {
    var key = String(row.WorkbookKey || '').toUpperCase();
    var definition = M4_INSTALLER.WORKBOOKS[key];

    if (!definition) {
      return;
    }

    if (row.ScriptProjectID) {
      try {
        m4iApiRequest_(
          'GET',
          '/' + encodeURIComponent(row.ScriptProjectID),
          null
        );

        m4iUpdateRow_(sheet, row._rowNumber, {
          ProjectStatus: 'PROJECT_READY',
          LastVerifiedAt: new Date(),
          ErrorMessage: '',
          Version: M4_INSTALLER.VERSION
        });

        verified++;
        return;
      } catch (ignored) {}
    }

    try {
      var project = m4iApiRequest_('POST', '', {
        title: definition.name + ' Script',
        parentId: definition.spreadsheetId
      });

      m4iUpdateRow_(sheet, row._rowNumber, {
        ScriptProjectID: project.scriptId,
        ProjectStatus: 'PROJECT_CREATED',
        LastVerifiedAt: new Date(),
        ErrorMessage: '',
        Version: M4_INSTALLER.VERSION
      });

      created++;
    } catch (error) {
      failed++;

      m4iUpdateRow_(sheet, row._rowNumber, {
        ProjectStatus: 'PROJECT_ERROR',
        ErrorMessage: m4iTruncate_(error.message || String(error), 500),
        LastVerifiedAt: new Date(),
        Version: M4_INSTALLER.VERSION
      });

      m4iLog_(core, 'PROJECTS', key, 'CREATE_BOUND_PROJECT',
        'FAILED', error.message || String(error));
    }
  });

  m4iUpdateStageStatus_(core, 'BOUND_PROJECTS',
    failed ? 'FAILED' : 'COMPLETE',
    rows.length,
    created + verified,
    0,
    failed,
    failed ? 'One or more projects failed.' : 'Bound projects are ready.');

  return {
    success: failed === 0,
    created: created,
    verified: verified,
    failed: failed,
    nextFunction: failed ? '' : 'melroseInstallerInventoryLegacyProject'
  };
}


function melroseInstallerInventoryLegacyProject() {
  var core = m4iOpenWorkbook_('CORE');
  var sheet = core.getSheetByName(
    M4_INSTALLER.CONTROL_SHEETS.SOURCE_FILES
  );

  var content = m4iGetProjectContent_(M4_INSTALLER.LEGACY.scriptId);
  var files = content.files || [];

  var inventory = files.map(function (file, index) {
    var record = {
      FileID: 'SOURCE-' + String(index + 1).padStart(4, '0'),
      SourceFileName: file.name || '',
      SourceFileType: file.type || '',
      DetectedAt: new Date(),
      Version: M4_INSTALLER.VERSION
    };

    Object.keys(M4_INSTALLER.WORKBOOKS).forEach(function (key) {
      record[key] = m4iFileBelongsToPackage_(file, key);
    });

    return record;
  });

  m4iReplaceAllObjects_(sheet, inventory);
  m4iBuildCleanupCandidateReport_(core, files);

  m4iUpdateStageStatus_(core, 'SOURCE_INVENTORY',
    'COMPLETE', files.length, files.length, 0, 0,
    files.length + ' legacy files inventoried.');

  return {
    success: true,
    filesInventoried: files.length,
    nextFunction: 'melroseInstallerBuildDeploymentQueue'
  };
}


function melroseInstallerBuildDeploymentQueue() {
  var core = m4iOpenWorkbook_('CORE');
  var projectsSheet = core.getSheetByName(
    M4_INSTALLER.CONTROL_SHEETS.PROJECTS
  );
  var queueSheet = core.getSheetByName(
    M4_INSTALLER.CONTROL_SHEETS.CODE_QUEUE
  );

  var projects = m4iReadObjects_(projectsSheet).filter(function (row) {
    return Boolean(String(row.ScriptProjectID || '').trim());
  });

  var queue = projects.map(function (row) {
    return {
      QueueID: 'CODE-' + row.WorkbookKey,
      WorkbookKey: row.WorkbookKey,
      SpreadsheetID: row.SpreadsheetID,
      ScriptProjectID: row.ScriptProjectID,
      Status: 'PENDING',
      AttemptCount: 0,
      StartedAt: '',
      CompletedAt: '',
      FilesDeployed: 0,
      ErrorMessage: '',
      UpdatedAt: new Date(),
      Version: M4_INSTALLER.VERSION
    };
  });

  m4iUpsertBatch_(queueSheet, 'QueueID', queue);
  m4iUpdateStageStatus_(core, 'CODE_QUEUE',
    'READY', queue.length, 0, 0, 0,
    'Code deployment queue is ready.');

  return {
    success: true,
    queued: queue.length,
    nextFunction: 'melroseInstallerInstallCodeTrigger'
  };
}


function melroseInstallerInstallCodeTrigger() {
  m4iDeleteTriggersByHandler_('melroseInstallerProcessNextCodePackage');

  ScriptApp.newTrigger('melroseInstallerProcessNextCodePackage')
    .timeBased()
    .everyMinutes(5)
    .create();

  return {
    success: true,
    triggerInstalled: true
  };
}


function melroseInstallerProcessNextCodePackage() {
  var core = m4iOpenWorkbook_('CORE');
  var queueSheet = core.getSheetByName(
    M4_INSTALLER.CONTROL_SHEETS.CODE_QUEUE
  );

  var item = m4iNextQueueItem_(queueSheet, ['PENDING', 'RETRY']);

  if (!item) {
    m4iDeleteTriggersByHandler_('melroseInstallerProcessNextCodePackage');
    m4iUpdateStageStatusFromQueue_(core, 'CODE_DEPLOYMENT', queueSheet);
    return {success: true, complete: true};
  }

  m4iUpdateRow_(queueSheet, item._rowNumber, {
    Status: 'IN_PROGRESS',
    AttemptCount: Number(item.AttemptCount || 0) + 1,
    StartedAt: item.StartedAt || new Date(),
    ErrorMessage: '',
    UpdatedAt: new Date()
  });

  try {
    var source = m4iGetProjectContent_(M4_INSTALLER.LEGACY.scriptId);
    var packageFiles = m4iBuildPackageFiles_(
      source.files || [],
      item.WorkbookKey,
      item.SpreadsheetID
    );

    if (!packageFiles.length) {
      throw new Error('No source files matched ' + item.WorkbookKey + '.');
    }

    m4iUpdateProjectContent_(item.ScriptProjectID, packageFiles);

    var verification = m4iGetProjectContent_(item.ScriptProjectID);
    var verified = Array.isArray(verification.files) &&
      verification.files.length === packageFiles.length;

    m4iUpdateRow_(queueSheet, item._rowNumber, {
      Status: verified ? 'VERIFIED' : 'WARNING',
      CompletedAt: new Date(),
      FilesDeployed: packageFiles.length,
      ErrorMessage: verified ? '' :
        'Project updated but file count verification differed.',
      UpdatedAt: new Date(),
      Version: M4_INSTALLER.VERSION
    });

    m4iUpdateProjectDeployStatus_(
      core,
      item.WorkbookKey,
      verified ? 'DEPLOYED' : 'DEPLOYED_WITH_WARNING',
      verified ? '' : 'File count verification differed.'
    );

    m4iLog_(core, 'CODE_DEPLOYMENT', item.WorkbookKey,
      'DEPLOY_PACKAGE', verified ? 'SUCCESS' : 'WARNING',
      packageFiles.length + ' files deployed.');

    return {
      success: verified,
      workbookKey: item.WorkbookKey,
      filesDeployed: packageFiles.length
    };
  } catch (error) {
    var attempts = Number(item.AttemptCount || 0) + 1;

    m4iUpdateRow_(queueSheet, item._rowNumber, {
      Status: attempts >= 3 ? 'FAILED' : 'RETRY',
      ErrorMessage: m4iTruncate_(error.message || String(error), 500),
      UpdatedAt: new Date(),
      Version: M4_INSTALLER.VERSION
    });

    m4iUpdateProjectDeployStatus_(
      core,
      item.WorkbookKey,
      'DEPLOYMENT_ERROR',
      error.message || String(error)
    );

    m4iLog_(core, 'CODE_DEPLOYMENT', item.WorkbookKey,
      'DEPLOY_PACKAGE', 'FAILED', error.message || String(error));

    throw error;
  }
}


function melroseInstallerInstallStructureTrigger() {
  var core = m4iOpenWorkbook_('CORE');
  var queueSheet = core.getSheetByName(
    M4_INSTALLER.CONTROL_SHEETS.STRUCTURE_QUEUE
  );

  var queue = [];

  Object.keys(M4_INSTALLER.SHEET_PACKAGES).forEach(function (key) {
    var workbook = M4_INSTALLER.WORKBOOKS[key];

    M4_INSTALLER.SHEET_PACKAGES[key].forEach(function (definition) {
      queue.push({
        QueueID: 'STRUCTURE-' + key + '-' + definition[0],
        WorkbookKey: key,
        SpreadsheetID: workbook.spreadsheetId,
        SheetName: definition[0],
        Status: 'PENDING',
        AttemptCount: 0,
        StartedAt: '',
        CompletedAt: '',
        ErrorMessage: '',
        UpdatedAt: new Date(),
        Version: M4_INSTALLER.VERSION
      });
    });
  });

  m4iUpsertBatch_(queueSheet, 'QueueID', queue);
  m4iDeleteTriggersByHandler_('melroseInstallerProcessNextStructureItem');

  ScriptApp.newTrigger('melroseInstallerProcessNextStructureItem')
    .timeBased()
    .everyMinutes(5)
    .create();

  return {
    success: true,
    queued: queue.length,
    triggerInstalled: true
  };
}


function melroseInstallerProcessNextStructureItem() {
  var core = m4iOpenWorkbook_('CORE');
  var queueSheet = core.getSheetByName(
    M4_INSTALLER.CONTROL_SHEETS.STRUCTURE_QUEUE
  );

  var item = m4iNextQueueItem_(queueSheet, ['PENDING', 'RETRY']);

  if (!item) {
    m4iDeleteTriggersByHandler_('melroseInstallerProcessNextStructureItem');
    m4iUpdateStageStatusFromQueue_(core, 'WORKBOOK_STRUCTURE', queueSheet);
    return {success: true, complete: true};
  }

  m4iUpdateRow_(queueSheet, item._rowNumber, {
    Status: 'IN_PROGRESS',
    AttemptCount: Number(item.AttemptCount || 0) + 1,
    StartedAt: item.StartedAt || new Date(),
    ErrorMessage: '',
    UpdatedAt: new Date()
  });

  try {
    var packageDefinitions =
      M4_INSTALLER.SHEET_PACKAGES[item.WorkbookKey] || [];

    var definition = packageDefinitions.find(function (candidate) {
      return candidate[0] === item.SheetName;
    });

    if (!definition) {
      throw new Error('Sheet definition was not found.');
    }

    var workbook = SpreadsheetApp.openById(item.SpreadsheetID);
    m4iEnsureSheet_(workbook, definition[0], definition[1]);

    m4iUpdateRow_(queueSheet, item._rowNumber, {
      Status: 'VERIFIED',
      CompletedAt: new Date(),
      ErrorMessage: '',
      UpdatedAt: new Date(),
      Version: M4_INSTALLER.VERSION
    });

    return {
      success: true,
      workbookKey: item.WorkbookKey,
      sheetName: item.SheetName
    };
  } catch (error) {
    var attempts = Number(item.AttemptCount || 0) + 1;

    m4iUpdateRow_(queueSheet, item._rowNumber, {
      Status: attempts >= 3 ? 'FAILED' : 'RETRY',
      ErrorMessage: m4iTruncate_(error.message || String(error), 500),
      UpdatedAt: new Date(),
      Version: M4_INSTALLER.VERSION
    });

    m4iLog_(core, 'WORKBOOK_STRUCTURE', item.WorkbookKey,
      'CREATE_SHEET', 'FAILED', item.SheetName + ': ' +
      (error.message || String(error)));

    throw error;
  }
}


function melroseInstallerBuildMigrationQueue() {
  var source = SpreadsheetApp.openById(
    M4_INSTALLER.LEGACY.spreadsheetId
  );
  var core = m4iOpenWorkbook_('CORE');
  var queueSheet = core.getSheetByName(
    M4_INSTALLER.CONTROL_SHEETS.MIGRATION_QUEUE
  );

  var queue = [];

  Object.keys(M4_INSTALLER.MIGRATION_ROUTING).forEach(function (key) {
    var destination = M4_INSTALLER.WORKBOOKS[key];

    M4_INSTALLER.MIGRATION_ROUTING[key].forEach(function (sheetName) {
      var sourceSheet = source.getSheetByName(sheetName);

      if (!sourceSheet) {
        return;
      }

      queue.push({
        MigrationID: 'MIGRATE-' + key + '-' + sheetName,
        SourceSpreadsheetID: M4_INSTALLER.LEGACY.spreadsheetId,
        SourceSheetName: sheetName,
        DestinationWorkbookKey: key,
        DestinationSpreadsheetID: destination.spreadsheetId,
        DestinationSheetName: sheetName,
        Status: 'PENDING',
        AttemptCount: 0,
        StartedAt: '',
        CompletedAt: '',
        SourceLastRow: sourceSheet.getLastRow(),
        SourceLastColumn: sourceSheet.getLastColumn(),
        DestinationLastRow: '',
        DestinationLastColumn: '',
        Verified: false,
        ErrorMessage: '',
        UpdatedAt: new Date(),
        Version: M4_INSTALLER.VERSION
      });
    });
  });

  m4iUpsertBatch_(queueSheet, 'MigrationID', queue);
  m4iUpdateStageStatus_(core, 'MIGRATION_QUEUE',
    'READY', queue.length, 0, 0, 0,
    queue.length + ' migration items queued.');

  return {
    success: true,
    queued: queue.length,
    nextFunction: 'melroseInstallerInstallMigrationTrigger'
  };
}


function melroseInstallerInstallMigrationTrigger() {
  m4iDeleteTriggersByHandler_('melroseInstallerProcessNextMigrationItem');

  ScriptApp.newTrigger('melroseInstallerProcessNextMigrationItem')
    .timeBased()
    .everyMinutes(5)
    .create();

  return {
    success: true,
    triggerInstalled: true
  };
}


function melroseInstallerProcessNextMigrationItem() {
  var core = m4iOpenWorkbook_('CORE');
  var queueSheet = core.getSheetByName(
    M4_INSTALLER.CONTROL_SHEETS.MIGRATION_QUEUE
  );

  var item = m4iNextQueueItem_(queueSheet, ['PENDING', 'RETRY']);

  if (!item) {
    m4iDeleteTriggersByHandler_('melroseInstallerProcessNextMigrationItem');
    m4iUpdateStageStatusFromQueue_(core, 'DATA_MIGRATION', queueSheet);
    return {success: true, complete: true};
  }

  m4iUpdateRow_(queueSheet, item._rowNumber, {
    Status: 'IN_PROGRESS',
    AttemptCount: Number(item.AttemptCount || 0) + 1,
    StartedAt: item.StartedAt || new Date(),
    ErrorMessage: '',
    UpdatedAt: new Date()
  });

  try {
    var sourceBook = SpreadsheetApp.openById(item.SourceSpreadsheetID);
    var destinationBook = SpreadsheetApp.openById(
      item.DestinationSpreadsheetID
    );

    var sourceSheet = sourceBook.getSheetByName(item.SourceSheetName);

    if (!sourceSheet) {
      throw new Error('Source sheet does not exist.');
    }

    var destinationName = item.DestinationSheetName;
    var existing = destinationBook.getSheetByName(destinationName);

    if (existing) {
      var backupName = (
        destinationName + '_PREMIGRATION_' + Date.now()
      ).slice(0, 99);
      existing.setName(backupName);
    }

    var copied = sourceSheet.copyTo(destinationBook);
    copied.setName(destinationName);
    SpreadsheetApp.flush();

    var sourceLastRow = sourceSheet.getLastRow();
    var sourceLastColumn = sourceSheet.getLastColumn();
    var destinationLastRow = copied.getLastRow();
    var destinationLastColumn = copied.getLastColumn();

    var verified =
      sourceLastRow === destinationLastRow &&
      sourceLastColumn === destinationLastColumn;

    m4iUpdateRow_(queueSheet, item._rowNumber, {
      Status: verified ? 'VERIFIED' : 'WARNING',
      CompletedAt: new Date(),
      SourceLastRow: sourceLastRow,
      SourceLastColumn: sourceLastColumn,
      DestinationLastRow: destinationLastRow,
      DestinationLastColumn: destinationLastColumn,
      Verified: verified,
      ErrorMessage: verified ? '' :
        'Used-range dimensions differ after copy.',
      UpdatedAt: new Date(),
      Version: M4_INSTALLER.VERSION
    });

    return {
      success: verified,
      sourceSheet: item.SourceSheetName,
      destinationWorkbook: item.DestinationWorkbookKey
    };
  } catch (error) {
    var attempts = Number(item.AttemptCount || 0) + 1;

    m4iUpdateRow_(queueSheet, item._rowNumber, {
      Status: attempts >= 3 ? 'FAILED' : 'RETRY',
      ErrorMessage: m4iTruncate_(error.message || String(error), 500),
      UpdatedAt: new Date(),
      Version: M4_INSTALLER.VERSION
    });

    m4iLog_(core, 'DATA_MIGRATION', item.DestinationWorkbookKey,
      'COPY_SHEET', 'FAILED', item.SourceSheetName + ': ' +
      (error.message || String(error)));

    throw error;
  }
}


function melroseInstallerRunValidation() {
  var core = m4iOpenWorkbook_('CORE');
  var validationSheet = core.getSheetByName(
    M4_INSTALLER.CONTROL_SHEETS.VALIDATION
  );
  var projectSheet = core.getSheetByName(
    M4_INSTALLER.CONTROL_SHEETS.PROJECTS
  );

  var projectMap = {};
  m4iReadObjects_(projectSheet).forEach(function (row) {
    projectMap[row.WorkbookKey] = row;
  });

  var results = [];

  Object.keys(M4_INSTALLER.WORKBOOKS).forEach(function (key) {
    var definition = M4_INSTALLER.WORKBOOKS[key];
    var workbook = SpreadsheetApp.openById(definition.spreadsheetId);
    var expectedSheets = M4_INSTALLER.SHEET_PACKAGES[key] || [];
    var project = projectMap[key] || {};

    results.push(m4iValidationRecord_(
      key,
      'WORKBOOK_ACCESS',
      definition.name,
      'PASS',
      'Accessible',
      'Accessible',
      'Workbook opened successfully.'
    ));

    expectedSheets.forEach(function (sheetDefinition) {
      var exists = Boolean(workbook.getSheetByName(sheetDefinition[0]));

      results.push(m4iValidationRecord_(
        key,
        'SHEET_EXISTS',
        sheetDefinition[0],
        exists ? 'PASS' : 'FAIL',
        'TRUE',
        String(exists).toUpperCase(),
        exists ? 'Sheet exists.' : 'Sheet is missing.'
      ));
    });

    results.push(m4iValidationRecord_(
      key,
      'SCRIPT_PROJECT',
      definition.name + ' Script',
      project.ScriptProjectID ? 'PASS' : 'FAIL',
      'ScriptProjectID',
      project.ScriptProjectID || '',
      project.ScriptProjectID ?
        'Bound script project is registered.' :
        'Bound script project is missing.'
    ));

    results.push(m4iValidationRecord_(
      key,
      'BOOTSTRAP_REQUIRED',
      'installMelroseWorkbookBootstrap',
      'ACTION_REQUIRED',
      'Run once',
      'Not remotely verifiable',
      'Open this workbook Apps Script project and run the bootstrap once.'
    ));
  });

  m4iReplaceAllObjects_(validationSheet, results);

  var failed = results.filter(function (row) {
    return row.Status === 'FAIL';
  }).length;

  var warnings = results.filter(function (row) {
    return row.Status === 'ACTION_REQUIRED' || row.Status === 'WARNING';
  }).length;

  m4iUpdateStageStatus_(core, 'VALIDATION',
    failed ? 'FAILED' : warnings ? 'ACTION_REQUIRED' : 'COMPLETE',
    results.length,
    results.length - failed - warnings,
    warnings,
    failed,
    failed ? 'Validation failures require correction.' :
      warnings ? 'Run bootstrap once in each destination project.' :
        'Validation completed.');

  return {
    success: failed === 0,
    totalChecks: results.length,
    failed: failed,
    actionRequired: warnings
  };
}


function melroseInstallerStatus() {
  var core = m4iOpenWorkbook_('CORE');

  var codeQueue = core.getSheetByName(
    M4_INSTALLER.CONTROL_SHEETS.CODE_QUEUE
  );
  var structureQueue = core.getSheetByName(
    M4_INSTALLER.CONTROL_SHEETS.STRUCTURE_QUEUE
  );
  var migrationQueue = core.getSheetByName(
    M4_INSTALLER.CONTROL_SHEETS.MIGRATION_QUEUE
  );
  var validationSheet = core.getSheetByName(
    M4_INSTALLER.CONTROL_SHEETS.VALIDATION
  );

  return {
    success: true,
    version: M4_INSTALLER.VERSION,
    codeDeployment: m4iQueueSummary_(codeQueue),
    workbookStructure: m4iQueueSummary_(structureQueue),
    dataMigration: m4iQueueSummary_(migrationQueue),
    validation: m4iValidationSummary_(validationSheet)
  };
}


/* =====================================================================
   PACKAGE BUILDING
===================================================================== */

function m4iBuildPackageFiles_(sourceFiles, workbookKey, spreadsheetId) {
  var key = String(workbookKey || '').toUpperCase();

  var files = sourceFiles.filter(function (file) {
    return (
      file.type === 'JSON' &&
      file.name === 'appsscript'
    ) || m4iFileBelongsToPackage_(file, key);
  }).map(function (file) {
    return {
      name: file.name,
      type: file.type,
      source: file.source || ''
    };
  });

  var manifestIndex = files.findIndex(function (file) {
    return file.type === 'JSON' && file.name === 'appsscript';
  });

  var manifestFile = m4iBuildManifest_(
    manifestIndex >= 0 ? files[manifestIndex].source : '',
    key
  );

  if (manifestIndex >= 0) {
    files[manifestIndex] = manifestFile;
  } else {
    files.push(manifestFile);
  }

  files.push({
    name: 'Distributed_Config',
    type: 'SERVER_JS',
    source: m4iDistributedConfigSource_(key, spreadsheetId)
  });

  files.push({
    name: 'Distributed_Bootstrap',
    type: 'SERVER_JS',
    source: m4iBootstrapSource_(key)
  });

  return m4iDeduplicateFiles_(files);
}


function m4iFileBelongsToPackage_(file, workbookKey) {
  if (!file || file.type !== 'SERVER_JS') {
    return false;
  }

  var rules = M4_INSTALLER.PACKAGE_RULES[workbookKey] || [];

  return rules.some(function (rule) {
    return rule.test(String(file.name || ''));
  });
}


function m4iBuildManifest_(source, workbookKey) {
  var manifest = {};

  try {
    manifest = JSON.parse(source || '{}');
  } catch (ignored) {}

  manifest.timeZone = manifest.timeZone || 'America/Chicago';
  manifest.exceptionLogging = 'STACKDRIVER';
  manifest.runtimeVersion = 'V8';

  var scopes = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/script.scriptapp',
    'https://www.googleapis.com/auth/script.external_request'
  ];

  if (workbookKey === 'CORE') {
    scopes.push('https://www.googleapis.com/auth/script.projects');
  }

  manifest.oauthScopes = Array.from(new Set(
    (manifest.oauthScopes || []).concat(scopes)
  ));

  return {
    name: 'appsscript',
    type: 'JSON',
    source: JSON.stringify(manifest, null, 2)
  };
}


function m4iDistributedConfigSource_(workbookKey, spreadsheetId) {
  return [
    '/** Auto-generated by MelroseOS Installer ' + M4_INSTALLER.VERSION + '. */',
    'var M4_DISTRIBUTED_CONFIG = Object.freeze({',
    "  WORKBOOK_KEY: '" + workbookKey + "',",
    "  SPREADSHEET_ID: '" + spreadsheetId + "',",
    "  CORE_SPREADSHEET_ID: '" +
      M4_INSTALLER.WORKBOOKS.CORE.spreadsheetId + "',",
    "  VERSION: '" + M4_INSTALLER.VERSION + "'",
    '});',
    '',
    'function getMelroseDistributedWorkbookConfig() {',
    '  return {',
    '    success: true,',
    '    workbookKey: M4_DISTRIBUTED_CONFIG.WORKBOOK_KEY,',
    '    spreadsheetId: M4_DISTRIBUTED_CONFIG.SPREADSHEET_ID,',
    '    coreSpreadsheetId: M4_DISTRIBUTED_CONFIG.CORE_SPREADSHEET_ID,',
    '    version: M4_DISTRIBUTED_CONFIG.VERSION',
    '  };',
    '}'
  ].join('\n');
}


function m4iBootstrapSource_(workbookKey) {
  var triggerDefinitions =
    M4_INSTALLER.BOOTSTRAP_TRIGGERS[workbookKey] || [];

  var triggerJson = JSON.stringify(triggerDefinitions);

  return [
    '/** Auto-generated one-time workbook bootstrap. */',
    'function installMelroseWorkbookBootstrap() {',
    '  var definitions = ' + triggerJson + ';',
    '  var existing = ScriptApp.getProjectTriggers();',
    '  var installed = 0;',
    '  var skipped = 0;',
    '  var missingHandlers = [];',
    '',
    '  definitions.forEach(function (definition) {',
    '    var handler = definition[0];',
    '    var unit = definition[1];',
    '    var interval = Number(definition[2]);',
    '',
    '    if (typeof this[handler] !== "function") {',
    '      missingHandlers.push(handler);',
    '      return;',
    '    }',
    '',
    '    var alreadyExists = existing.some(function (trigger) {',
    '      return trigger.getHandlerFunction() === handler;',
    '    });',
    '',
    '    if (alreadyExists) {',
    '      skipped++;',
    '      return;',
    '    }',
    '',
    '    var builder = ScriptApp.newTrigger(handler).timeBased();',
    '',
    '    if (unit === "MINUTES") {',
    '      builder.everyMinutes(interval);',
    '    } else if (unit === "HOURS") {',
    '      builder.everyHours(interval);',
    '    } else if (unit === "DAYS") {',
    '      builder.everyDays(interval);',
    '    } else {',
    '      missingHandlers.push(handler + " [invalid schedule]");',
    '      return;',
    '    }',
    '',
    '    builder.create();',
    '    installed++;',
    '  });',
    '',
    '  PropertiesService.getScriptProperties().setProperty(',
    '    "MELROSEOS_WORKBOOK_BOOTSTRAP_VERSION",',
    '    M4_DISTRIBUTED_CONFIG.VERSION',
    '  );',
    '',
    '  return {',
    '    success: missingHandlers.length === 0,',
    '    workbookKey: M4_DISTRIBUTED_CONFIG.WORKBOOK_KEY,',
    '    installed: installed,',
    '    skipped: skipped,',
    '    missingHandlers: missingHandlers,',
    '    version: M4_DISTRIBUTED_CONFIG.VERSION',
    '  };',
    '}',
    '',
    'function getMelroseWorkbookBootstrapStatus() {',
    '  return {',
    '    success: true,',
    '    workbookKey: M4_DISTRIBUTED_CONFIG.WORKBOOK_KEY,',
    '    version: PropertiesService.getScriptProperties().getProperty(',
    '      "MELROSEOS_WORKBOOK_BOOTSTRAP_VERSION"',
    '    ) || "",',
    '    triggers: ScriptApp.getProjectTriggers().map(function (trigger) {',
    '      return {',
    '        handler: trigger.getHandlerFunction(),',
    '        eventType: String(trigger.getEventType())',
    '      };',
    '    })',
    '  };',
    '}'
  ].join('\n');
}


function m4iDeduplicateFiles_(files) {
  var map = {};

  files.forEach(function (file) {
    map[file.type + '|' + file.name] = file;
  });

  return Object.keys(map).map(function (key) {
    return map[key];
  });
}


/* =====================================================================
   APPS SCRIPT API
===================================================================== */

function m4iGetProjectContent_(scriptId) {
  return m4iApiRequest_(
    'GET',
    '/' + encodeURIComponent(scriptId) + '/content',
    null
  );
}


function m4iUpdateProjectContent_(scriptId, files) {
  return m4iApiRequest_(
    'PUT',
    '/' + encodeURIComponent(scriptId) + '/content',
    {files: files}
  );
}


function m4iApiRequest_(method, path, payload) {
  var options = {
    method: method,
    muteHttpExceptions: true,
    headers: {
      Authorization: 'Bearer ' + ScriptApp.getOAuthToken()
    }
  };

  if (payload !== null) {
    options.contentType = 'application/json';
    options.payload = JSON.stringify(payload);
  }

  var response = UrlFetchApp.fetch(
    M4_INSTALLER.API_ROOT + path,
    options
  );

  var status = response.getResponseCode();
  var body = response.getContentText();
  var parsed = {};

  if (body) {
    try {
      parsed = JSON.parse(body);
    } catch (ignored) {
      parsed = {rawResponse: body};
    }
  }

  if (status < 200 || status >= 300) {
    var message = parsed && parsed.error && parsed.error.message ?
      parsed.error.message : body;

    throw new Error(
      'Apps Script API ' + method + ' failed (' + status + '): ' + message
    );
  }

  return parsed;
}


/* =====================================================================
   REPORTING / STATUS
===================================================================== */

function m4iBuildCleanupCandidateReport_(core, sourceFiles) {
  var sheet = core.getSheetByName(
    M4_INSTALLER.CONTROL_SHEETS.CLEANUP
  );

  var groups = {};
  var records = [];

  sourceFiles.forEach(function (file) {
    if (file.type !== 'SERVER_JS') {
      return;
    }

    var normalized = String(file.name || '')
      .replace(/[_-]?v?\d+([._-]\d+)*/gi, '')
      .replace(/[_-]?(old|backup|copy|test|temp|draft|overwrite)$/i, '')
      .toLowerCase();

    groups[normalized] = groups[normalized] || [];
    groups[normalized].push(file.name);
  });

  Object.keys(groups).forEach(function (normalized) {
    var names = groups[normalized];

    if (names.length > 1) {
      names.forEach(function (name) {
        records.push({
          CandidateID: 'FILE-' + Utilities.getUuid(),
          CandidateType: 'POSSIBLE_DUPLICATE_SCRIPT',
          SourceName: name,
          Reason: 'Multiple files appear to represent the same component: ' +
            names.join(', '),
          RecommendedAction:
            'Review after distributed deployment passes validation.',
          SafeToDelete: false,
          Reviewed: false,
          ReviewedAt: '',
          Notes: '',
          Version: M4_INSTALLER.VERSION
        });
      });
    }
  });

  sourceFiles.forEach(function (file) {
    if (
      file.type === 'SERVER_JS' &&
      /(old|backup|copy|test|temp|draft)/i.test(file.name)
    ) {
      records.push({
        CandidateID: 'FILE-' + Utilities.getUuid(),
        CandidateType: 'LEGACY_OR_TEST_SCRIPT',
        SourceName: file.name,
        Reason: 'File name indicates a legacy, test, temporary, or backup file.',
        RecommendedAction:
          'Review after distributed deployment passes validation.',
        SafeToDelete: false,
        Reviewed: false,
        ReviewedAt: '',
        Notes: '',
        Version: M4_INSTALLER.VERSION
      });
    }
  });

  m4iReplaceAllObjects_(sheet, records);
}


function m4iValidationRecord_(
  workbookKey,
  validationType,
  targetName,
  status,
  expectedValue,
  actualValue,
  message
) {
  return {
    ValidationID: 'VALIDATE-' + Utilities.getUuid(),
    WorkbookKey: workbookKey,
    ValidationType: validationType,
    TargetName: targetName,
    Status: status,
    ExpectedValue: expectedValue,
    ActualValue: actualValue,
    Message: message,
    CheckedAt: new Date(),
    Version: M4_INSTALLER.VERSION
  };
}


function m4iQueueSummary_(sheet) {
  if (!sheet) {
    return {total: 0, pending: 0, verified: 0, warnings: 0, failed: 0};
  }

  var rows = m4iReadObjects_(sheet);

  function count(statuses) {
    return rows.filter(function (row) {
      return statuses.indexOf(
        String(row.Status || '').toUpperCase()
      ) >= 0;
    }).length;
  }

  return {
    total: rows.length,
    pending: count(['PENDING','RETRY','IN_PROGRESS']),
    verified: count(['VERIFIED']),
    warnings: count(['WARNING','COPIED_WITH_WARNING','DEPLOYED_WITH_WARNING']),
    failed: count(['FAILED'])
  };
}


function m4iValidationSummary_(sheet) {
  if (!sheet) {
    return {total: 0, passed: 0, actionRequired: 0, failed: 0};
  }

  var rows = m4iReadObjects_(sheet);

  return {
    total: rows.length,
    passed: rows.filter(function (row) {
      return row.Status === 'PASS';
    }).length,
    actionRequired: rows.filter(function (row) {
      return row.Status === 'ACTION_REQUIRED' || row.Status === 'WARNING';
    }).length,
    failed: rows.filter(function (row) {
      return row.Status === 'FAIL';
    }).length
  };
}


function m4iUpdateStageStatusFromQueue_(core, stage, queueSheet) {
  var summary = m4iQueueSummary_(queueSheet);

  var status = summary.failed ? 'FAILED' :
    summary.pending ? 'RUNNING' :
      summary.warnings ? 'WARNING' : 'COMPLETE';

  m4iUpdateStageStatus_(
    core,
    stage,
    status,
    summary.total,
    summary.verified,
    summary.warnings,
    summary.failed,
    status === 'COMPLETE' ?
      'Stage completed.' :
      status === 'WARNING' ?
        'Stage completed with warnings.' :
        status === 'FAILED' ?
          'Stage has failed items.' :
          'Stage is still running.'
  );
}


function m4iUpdateStageStatus_(
  core,
  stage,
  status,
  total,
  completed,
  warnings,
  failed,
  message
) {
  var sheet = core.getSheetByName(
    M4_INSTALLER.CONTROL_SHEETS.STATUS
  );

  m4iUpsertBatch_(sheet, 'Stage', [{
    Stage: stage,
    Status: status,
    TotalItems: total,
    CompletedItems: completed,
    WarningItems: warnings,
    FailedItems: failed,
    LastUpdatedAt: new Date(),
    Message: message
  }]);
}


/* =====================================================================
   REGISTRY / SETTINGS
===================================================================== */

function m4iSeedWorkbookRegistry_() {
  var core = m4iOpenWorkbook_('CORE');
  var sheet = core.getSheetByName(
    M4_INSTALLER.CONTROL_SHEETS.WORKBOOKS
  );

  var rows = Object.keys(M4_INSTALLER.WORKBOOKS).map(function (key) {
    var definition = M4_INSTALLER.WORKBOOKS[key];
    var workbook = SpreadsheetApp.openById(definition.spreadsheetId);

    return {
      WorkbookKey: key,
      WorkbookName: definition.name,
      SpreadsheetID: definition.spreadsheetId,
      SpreadsheetURL: workbook.getUrl(),
      AccessStatus: 'NOT_CHECKED',
      CellCount: m4iWorkbookCellCount_(workbook),
      SheetCount: workbook.getSheets().length,
      LastCheckedAt: new Date(),
      Version: M4_INSTALLER.VERSION
    };
  });

  m4iUpsertBatch_(sheet, 'WorkbookKey', rows);
}


function m4iSeedScriptProjectRegistry_() {
  var core = m4iOpenWorkbook_('CORE');
  var sheet = core.getSheetByName(
    M4_INSTALLER.CONTROL_SHEETS.PROJECTS
  );

  var rows = Object.keys(M4_INSTALLER.WORKBOOKS).map(function (key) {
    var definition = M4_INSTALLER.WORKBOOKS[key];

    return {
      WorkbookKey: key,
      WorkbookName: definition.name,
      SpreadsheetID: definition.spreadsheetId,
      ScriptProjectID: '',
      ProjectStatus: 'NOT_CREATED',
      LastDeployedAt: '',
      LastVerifiedAt: '',
      ErrorMessage: '',
      Version: M4_INSTALLER.VERSION
    };
  });

  m4iUpsertBatch_(sheet, 'WorkbookKey', rows);
}


function m4iWriteDistributedSettings_() {
  var core = m4iOpenWorkbook_('CORE');

  var settings = m4iEnsureSheet_(
    core,
    'MelroseOS_Settings',
    [
      'SettingKey','SettingValue','SettingType','Category',
      'Description','Required','UpdatedAt','UpdatedBy'
    ]
  );

  var rows = [];

  Object.keys(M4_INSTALLER.WORKBOOKS).forEach(function (key) {
    var definition = M4_INSTALLER.WORKBOOKS[key];

    rows.push({
      SettingKey: 'WORKBOOK_' + key + '_SPREADSHEET_ID',
      SettingValue: definition.spreadsheetId,
      SettingType: 'STRING',
      Category: 'SYSTEM',
      Description: definition.name + ' spreadsheet ID.',
      Required: true,
      UpdatedAt: new Date(),
      UpdatedBy: Session.getEffectiveUser().getEmail() || 'UNKNOWN_USER'
    });
  });

  rows.push({
    SettingKey: 'LEGACY_SPREADSHEET_ID',
    SettingValue: M4_INSTALLER.LEGACY.spreadsheetId,
    SettingType: 'STRING',
    Category: 'SYSTEM',
    Description: 'Frozen legacy MelroseOS spreadsheet ID.',
    Required: true,
    UpdatedAt: new Date(),
    UpdatedBy: Session.getEffectiveUser().getEmail() || 'UNKNOWN_USER'
  });

  rows.push({
    SettingKey: 'LEGACY_SCRIPT_ID',
    SettingValue: M4_INSTALLER.LEGACY.scriptId,
    SettingType: 'STRING',
    Category: 'SYSTEM',
    Description: 'Frozen legacy MelroseOS Apps Script project ID.',
    Required: true,
    UpdatedAt: new Date(),
    UpdatedBy: Session.getEffectiveUser().getEmail() || 'UNKNOWN_USER'
  });

  m4iUpsertBatch_(settings, 'SettingKey', rows);
}


function m4iUpdateProjectDeployStatus_(core, workbookKey, status, errorMessage) {
  var sheet = core.getSheetByName(
    M4_INSTALLER.CONTROL_SHEETS.PROJECTS
  );

  var row = m4iReadObjects_(sheet, true).find(function (record) {
    return String(record.WorkbookKey || '').toUpperCase() ===
      String(workbookKey || '').toUpperCase();
  });

  if (!row) {
    return;
  }

  m4iUpdateRow_(sheet, row._rowNumber, {
    ProjectStatus: status,
    LastDeployedAt: new Date(),
    LastVerifiedAt: new Date(),
    ErrorMessage: m4iTruncate_(errorMessage || '', 500),
    Version: M4_INSTALLER.VERSION
  });
}


/* =====================================================================
   SPREADSHEET HELPERS
===================================================================== */

function m4iOpenWorkbook_(key) {
  var definition = M4_INSTALLER.WORKBOOKS[
    String(key || '').toUpperCase()
  ];

  if (!definition) {
    throw new Error('Unknown workbook key: ' + key);
  }

  return SpreadsheetApp.openById(definition.spreadsheetId);
}


function m4iEnsureSheet_(spreadsheet, sheetName, headers) {
  var sheet = spreadsheet.getSheetByName(sheetName);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  }

  if (sheet.getMaxColumns() < headers.length) {
    sheet.insertColumnsAfter(
      sheet.getMaxColumns(),
      headers.length - sheet.getMaxColumns()
    );
  }

  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  var current = headerRange.getDisplayValues()[0];

  headers.forEach(function (header, index) {
    if (!current[index]) {
      current[index] = header;
    }
  });

  headerRange.setValues([current]);
  sheet.setFrozenRows(1);

  return sheet;
}


function m4iReadObjects_(sheet, includeRowNumber) {
  if (!sheet || sheet.getLastRow() < 2) {
    return [];
  }

  var values = sheet.getRange(
    1, 1, sheet.getLastRow(), sheet.getLastColumn()
  ).getValues();

  var headers = values[0].map(function (value) {
    return String(value || '').trim();
  });

  return values.slice(1).map(function (row, index) {
    var record = {};

    headers.forEach(function (header, columnIndex) {
      if (header) {
        record[header] = row[columnIndex];
      }
    });

    if (includeRowNumber) {
      record._rowNumber = index + 2;
    }

    return record;
  }).filter(function (record) {
    return Object.keys(record).filter(function (key) {
      return key !== '_rowNumber';
    }).some(function (key) {
      return String(record[key] || '').trim() !== '';
    });
  });
}


function m4iUpsertBatch_(sheet, primaryKey, incoming) {
  var headers = sheet.getRange(
    1, 1, 1, sheet.getLastColumn()
  ).getDisplayValues()[0].map(function (value) {
    return String(value || '').trim();
  });

  var map = {};

  m4iReadObjects_(sheet).forEach(function (record) {
    var key = String(record[primaryKey] || '').trim();

    if (key) {
      map[key] = record;
    }
  });

  incoming.forEach(function (record) {
    var key = String(record[primaryKey] || '').trim();

    if (!key) {
      return;
    }

    map[key] = Object.assign({}, map[key] || {}, record);
  });

  m4iReplaceAllObjects_(sheet, Object.keys(map).map(function (key) {
    return map[key];
  }), headers);
}


function m4iReplaceAllObjects_(sheet, records, optionalHeaders) {
  var headers = optionalHeaders || sheet.getRange(
    1, 1, 1, sheet.getLastColumn()
  ).getDisplayValues()[0].map(function (value) {
    return String(value || '').trim();
  });

  if (sheet.getLastRow() >= 2) {
    sheet.getRange(
      2, 1, sheet.getLastRow() - 1, headers.length
    ).clearContent();
  }

  if (!records.length) {
    return;
  }

  var rows = records.map(function (record) {
    return headers.map(function (header) {
      return Object.prototype.hasOwnProperty.call(record, header) ?
        record[header] : '';
    });
  });

  if (sheet.getMaxRows() < rows.length + 1) {
    sheet.insertRowsAfter(
      sheet.getMaxRows(),
      rows.length + 1 - sheet.getMaxRows()
    );
  }

  sheet.getRange(
    2, 1, rows.length, headers.length
  ).setValues(rows);
}


function m4iUpdateRow_(sheet, rowNumber, updates) {
  var headers = sheet.getRange(
    1, 1, 1, sheet.getLastColumn()
  ).getDisplayValues()[0].map(function (value) {
    return String(value || '').trim();
  });

  var values = sheet.getRange(
    rowNumber, 1, 1, headers.length
  ).getValues()[0];

  headers.forEach(function (header, index) {
    if (Object.prototype.hasOwnProperty.call(updates, header)) {
      values[index] = updates[header];
    }
  });

  sheet.getRange(
    rowNumber, 1, 1, headers.length
  ).setValues([values]);
}


function m4iAppendObject_(sheet, record) {
  var headers = sheet.getRange(
    1, 1, 1, sheet.getLastColumn()
  ).getDisplayValues()[0].map(function (value) {
    return String(value || '').trim();
  });

  var values = headers.map(function (header) {
    return Object.prototype.hasOwnProperty.call(record, header) ?
      record[header] : '';
  });

  var rowNumber = Math.max(2, sheet.getLastRow() + 1);

  if (sheet.getMaxRows() < rowNumber) {
    sheet.insertRowsAfter(
      sheet.getMaxRows(),
      rowNumber - sheet.getMaxRows()
    );
  }

  sheet.getRange(
    rowNumber, 1, 1, headers.length
  ).setValues([values]);
}


function m4iNextQueueItem_(sheet, statuses) {
  return m4iReadObjects_(sheet, true)
    .filter(function (row) {
      return statuses.indexOf(
        String(row.Status || '').toUpperCase()
      ) >= 0;
    })
    .sort(function (a, b) {
      return Number(a.AttemptCount || 0) - Number(b.AttemptCount || 0);
    })[0] || null;
}


function m4iWorkbookCellCount_(spreadsheet) {
  return spreadsheet.getSheets().reduce(function (total, sheet) {
    return total + sheet.getMaxRows() * sheet.getMaxColumns();
  }, 0);
}


/* =====================================================================
   GENERIC HELPERS
===================================================================== */

function m4iDeleteTriggersByHandler_(handler) {
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === handler) {
      ScriptApp.deleteTrigger(trigger);
    }
  });
}


function m4iTruncate_(value, maximumLength) {
  var text = String(value || '');
  var maximum = Number(maximumLength || 0);

  if (!maximum || text.length <= maximum) {
    return text;
  }

  return text.slice(0, Math.max(0, maximum - 1)) + '…';
}


function m4iLog_(core, stage, workbookKey, action, status, message) {
  var sheet = core.getSheetByName(
    M4_INSTALLER.CONTROL_SHEETS.LOG
  );

  if (!sheet) {
    return;
  }

  m4iAppendObject_(sheet, {
    LogID: 'INSTALLER-' + Utilities.getUuid(),
    Stage: stage || '',
    WorkbookKey: workbookKey || '',
    Action: action || '',
    Status: status || '',
    Message: m4iTruncate_(message || '', 500),
    RecordedAt: new Date(),
    RecordedBy: Session.getEffectiveUser().getEmail() || 'UNKNOWN_USER',
    Version: M4_INSTALLER.VERSION
  });
}


/* =====================================================================
   TEST
===================================================================== */

function testMelroseInstaller() {
  var results = {};

  Object.keys(M4_INSTALLER.WORKBOOKS).forEach(function (key) {
    try {
      var workbook = m4iOpenWorkbook_(key);

      results[key] = {
        accessible: true,
        name: workbook.getName(),
        spreadsheetId: workbook.getId(),
        sheetCount: workbook.getSheets().length,
        cellCount: m4iWorkbookCellCount_(workbook)
      };
    } catch (error) {
      results[key] = {
        accessible: false,
        error: error.message || String(error)
      };
    }
  });

  var sourceProjectAccessible = false;
  var sourceProjectError = '';

  try {
    m4iGetProjectContent_(M4_INSTALLER.LEGACY.scriptId);
    sourceProjectAccessible = true;
  } catch (error) {
    sourceProjectError = error.message || String(error);
  }

  return {
    success: Object.keys(results).every(function (key) {
      return results[key].accessible;
    }) && sourceProjectAccessible,
    version: M4_INSTALLER.VERSION,
    workbooks: results,
    sourceProjectAccessible: sourceProjectAccessible,
    sourceProjectError: sourceProjectError
  };
}
