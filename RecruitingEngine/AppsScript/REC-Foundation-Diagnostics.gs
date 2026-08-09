/**
 * MOS5-021 foundation diagnostic entrypoint.
 */
function REC_runFoundationSuite() {
  const results = {
    common: REC_runFoundationDiagnostics(),
    spreadsheet: REC_runSpreadsheetDiagnostics(),
    schema: REC_runSchemaDiagnostics()
  };

  console.log(JSON.stringify(results, null, 2));
  return results;
}
