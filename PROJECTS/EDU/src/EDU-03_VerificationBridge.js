/******************************************************************************
 * MelroseOS Enterprise
 * Project : Enterprise Education
 * File    : EDU-03_VerificationBridge.js
 * Version : 1.0.0
 *
 * Purpose:
 *   Connects the EDU project with the Enterprise Verification Engine.
 *
 * Responsibilities
 *   • Registers EDU agents as VERIFY subjects
 *   • Requests enterprise verification
 *   • Reads verification status
 *   • Updates Education Snapshot
 *   • Never performs verification itself
 ******************************************************************************/

const EDU_VERIFICATION_BRIDGE_VERSION =
    "1.0.0";

/* ========================================================================== */
/* AGENT SYNCHRONIZATION */
/* ========================================================================== */

function EDU_syncAgentsToVerification() {

    EDU_initializeCore();

    const agents =
        EDU_getAgents();

    const results = [];

    agents.forEach(function(agent){

        try {

            VERIFY_upsertSubject({

                SubjectID:
                    agent.AgentID,

                SubjectType:
                    "AGENT",

                DisplayName:
                    agent.DisplayName,

                Email:
                    agent.Email,

                ExternalID:
                    agent.LicenseNumber,

                Active:
                    EDU_isTrue_(
                        agent.Active
                    )

            });

            results.push({

                AgentID:
                    agent.AgentID,

                Status:
                    "SYNCED"

            });

        }

        catch(error){

            results.push({

                AgentID:
                    agent.AgentID,

                Status:
                    "FAILED",

                Error:
                    String(
                        error.message ||
                        error
                    )

            });

        }

    });

    return {

        success:
            true,

        total:
            agents.length,

        synced:
            results.filter(function(r){

                return r.Status==="SYNCED";

            }).length,

        failed:
            results.filter(function(r){

                return r.Status==="FAILED";

            }).length,

        results:
            results,

        completedAt:
            new Date()
                .toISOString()

    };

}

/* ========================================================================== */
/* VERIFY ONE AGENT */
/* ========================================================================== */

function EDU_verifyAgentEducation(
    agentId,
    options
) {

    const opts =
        options || {};

    const verificationTypes = [

        VERIFY.TYPE.LICENSE,

        VERIFY.TYPE.CONTINUING_EDUCATION

    ];

    const verification =
        VERIFY_verifySubject(

            agentId,

            verificationTypes,

            opts

        );

    if(
        typeof EDU_buildAgentSnapshot_ ===
        "function"
    ){

        const agent =
            EDU_getAgent(
                agentId
            );

        if(agent){

            EDU_buildAgentSnapshot_(
                agent
            );

        }

    }

    return verification;

}

/* ========================================================================== */
/* VERIFY ALL MONITORED AGENTS */
/* ========================================================================== */

function EDU_verifyAllMonitoredAgents(
    options
){

    const agents =
        EDU_getAgents();

    const results = [];

    agents.forEach(function(agent){

        results.push(

            EDU_verifyAgentEducation(

                agent.AgentID,

                options

            )

        );

    });

    return {

        success:
            true,

        total:
            agents.length,

        results:
            results,

        completedAt:
            new Date()
                .toISOString()

    };

}

/* ========================================================================== */
/* SNAPSHOT */
/* ========================================================================== */

function EDU_getAgentVerificationSnapshot(
    agentId
){

    const results =

        VERIFY_getSubjectResults(
            agentId
        );

    const overrides =

        VERIFY_getSubjectOverrides(
            agentId
        );

    return {

        AgentID:
            agentId,

        Results:
            results,

        Overrides:
            overrides,

        GeneratedAt:
            new Date()
                .toISOString()

    };

}

/* ========================================================================== */
/* END PART 1 */
/* ========================================================================== */
/* ========================================================================== */
/* BRIDGE STATUS */
/* ========================================================================== */

function EDU_getVerificationBridgeStatus() {

    const agents =
        EDU_getAgents();

    let synchronized = 0;

    let verified = 0;

    let pending = 0;

    let failed = 0;

    agents.forEach(function(agent){

        const subject =
            VERIFY_getSubject(
                agent.AgentID
            );

        if(subject){
            synchronized++;
        }

        const summary =
            VERIFY_verifySubject(
                agent.AgentID,
                [
                    VERIFY.TYPE.LICENSE,
                    VERIFY.TYPE.CONTINUING_EDUCATION
                ],
                {
                    IgnoreOverride:true
                }
            );

        if(summary.failed>0){

            failed++;

        }
        else if(summary.unknown>0){

            pending++;

        }
        else{

            verified++;

        }

    });

    return {

        release:
            "MOS5-007",

        version:
            EDU_VERIFICATION_BRIDGE_VERSION,

        totalAgents:
            agents.length,

        synchronized:
            synchronized,

        verified:
            verified,

        pending:
            pending,

        failed:
            failed,

        generatedAt:
            new Date()
                .toISOString()

    };

}

/* ========================================================================== */
/* OPS RUNTIME */
/* ========================================================================== */

function EDU_getRuntimeHealth() {

    const bridge =
        EDU_getVerificationBridgeStatus();

    const diagnostics =
        EDU_runVerificationBridgeDiagnostics();

    return {

        subsystem:
            "EDU",

        subsystemName:
            "Enterprise Education",

        release:
            "MOS5-007",

        version:
            EDU_VERIFICATION_BRIDGE_VERSION,

        status:
            diagnostics.overallStatus,

        healthy:
            diagnostics.overallStatus==="PASS",

        score:
            diagnostics.failed===0
                ?100
                :Math.max(
                    0,
                    100-
                    (
                        diagnostics.failed*
                        25
                    )
                ),

        synchronized:
            bridge.synchronized,

        totalAgents:
            bridge.totalAgents,

        generatedAt:
            new Date()
                .toISOString()

    };

}

/* ========================================================================== */
/* BCC PAYLOAD */
/* ========================================================================== */

function EDU_getBrokerPayload() {

    const bridge =
        EDU_getVerificationBridgeStatus();

    return {

        subsystem:
            "EDU",

        title:
            "Education",

        status:
            bridge.failed===0
                ?"PASS"
                :"WARNING",

        cards:[

            {

                label:
                    "Agents",

                value:
                    bridge.totalAgents

            },

            {

                label:
                    "Verified",

                value:
                    bridge.verified

            },

            {

                label:
                    "Pending",

                value:
                    bridge.pending

            },

            {

                label:
                    "Failed",

                value:
                    bridge.failed

            }

        ],

        generatedAt:
            new Date()
                .toISOString()

    };

}

/* ========================================================================== */
/* DIAGNOSTICS */
/* ========================================================================== */

function EDU_runVerificationBridgeDiagnostics() {

    const required = [

        "EDU_syncAgentsToVerification",

        "EDU_verifyAgentEducation",

        "EDU_verifyAllMonitoredAgents",

        "EDU_getVerificationBridgeStatus",

        "VERIFY_verifySubject"

    ];

    const tests =
        required.map(function(fn){

            return{

                code:
                    fn,

                status:
                    typeof globalThis[
                        fn
                    ]==="function"
                        ?"PASS"
                        :"FAIL"

            };

        });

    const failed =
        tests.filter(function(t){

            return(
                t.status==="FAIL"
            );

        }).length;

    return{

        release:
            "MOS5-007",

        version:
            EDU_VERIFICATION_BRIDGE_VERSION,

        overallStatus:
            failed===0
                ?"PASS"
                :"FAIL",

        passed:
            tests.length-
            failed,

        failed:
            failed,

        tests:
            tests,

        completedAt:
            new Date()
                .toISOString()

    };

}

/* ========================================================================== */
/* SELF TEST */
/* ========================================================================== */

function EDU_testVerificationBridge() {

    EDU_initializeCore();

    const diagnostics =
        EDU_runVerificationBridgeDiagnostics();

    if(
        diagnostics.overallStatus!=="PASS"
    ){

        throw new Error(
            "Verification Bridge diagnostics failed."
        );

    }

    return{

        success:true,

        release:
            "MOS5-007",

        version:
            EDU_VERIFICATION_BRIDGE_VERSION,

        diagnostics:
            diagnostics,

        runtime:
            EDU_getRuntimeHealth(),

        broker:
            EDU_getBrokerPayload()

    };

}

/* ========================================================================== */
/* END OF FILE */
/* ========================================================================== */