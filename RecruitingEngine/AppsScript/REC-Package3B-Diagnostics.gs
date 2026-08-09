/**
 * MOS5-021 Package 3B diagnostics.
 */
function REC_runPackage3BSuite() {
  REC_assertSafeMode();

  const results = {
    brandAssets: REC_runBrandAssetDiagnostics(),
    testMailer: REC_runTestMailerDiagnostics(),
    policy: REC_runSuppressionDiagnostics()
  };

  console.log(JSON.stringify(results, null, 2));
  return results;
}
