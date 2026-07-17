const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

console.log("=== RUNNING EDGE FUNCTIONS COMPLIANCE CHECKS ===");

const SUPABASE_URL = 'https://yzaxzmuuvozonhgwhlim.supabase.co';
const FN_BASE = `${SUPABASE_URL}/functions/v1`;
const testEmail = "whealthylabel@gmail.com";

// Parse Anon Key from index.html
let SUPABASE_ANON_KEY = '';
try {
  const indexPath = path.join(__dirname, 'index.html');
  const indexContent = fs.readFileSync(indexPath, 'utf8');
  const match = indexContent.match(/const SUPABASE_ANON\s*=\s*'([^']+)'/);
  if (match) {
    SUPABASE_ANON_KEY = match[1].trim();
  }
} catch (e) {
  console.error("Failed to read index.html:", e.message);
}

if (!SUPABASE_ANON_KEY) {
  console.error("Could not find SUPABASE_ANON_KEY in index.html");
  process.exit(1);
}

const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function callFn(fnName, payload) {
  const res = await fetch(`${FN_BASE}/${fnName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
    },
    body: JSON.stringify(payload)
  });
  let data;
  try {
    data = await res.json();
  } catch (e) {
    data = { error: 'invalid_json' };
  }
  return { status: res.status, data };
}

(async () => {
  try {
    // --- CHECK 1: RLS on bible_reflections ---
    console.log("\nChecking Check 1: RLS on bible_reflections...");
    const { error: anonError } = await anonClient
      .from('bible_reflections')
      .insert({
        member_email: 'test_anon@gmail.com',
        day_number: 1,
        scripture_ref: 'Genesis 1:1',
        text: 'Test reflection'
      });

    if (anonError) {
      console.log("✅ Anon client write blocked correctly:", anonError.message);
    } else {
      throw new Error("Security Violation: Anon client successfully inserted into bible_reflections directly!");
    }

    // --- CHECK 7: prayers-read answered returns no counts, ratios, or percentages ---
    console.log("\nChecking Check 7: prayers-read answered does not return aggregates...");
    const { status: readStatus, data: answeredData } = await callFn("prayers-read", {
      email: testEmail,
      view: "answered"
    });

    if (readStatus !== 200) {
      throw new Error(`Failed to read answered. Status: ${readStatus}, Data: ${JSON.stringify(answeredData)}`);
    }

    if (answeredData && Array.isArray(answeredData.prayers)) {
      const hasForbidden = answeredData.prayers.some(row => {
        const keys = Object.keys(row);
        return keys.some(k => ["ratio", "percentage", "total"].includes(k.toLowerCase()));
      });
      if (hasForbidden) {
        throw new Error("Check 7 failed: Response contains forbidden numerical aggregates!");
      }
      console.log("✅ Check 7 passed: Answered view returns rows with no aggregates or ratios.");
    } else {
      throw new Error("Check 7 failed: Answered view did not return a clean prayers array.");
    }

    // --- CHECK 8: prayer-state advance loops 6 -> 1 ---
    console.log("\nChecking Check 8: Midday rotation loops successfully...");
    // Force reset step to 6
    await callFn("prayer-state", { email: testEmail, action: "jump", movement: 6 });
    // Advance it
    const { data: advData } = await callFn("prayer-state", { email: testEmail, action: "advance" });
    if (advData.midday_next_movement === 1) {
      console.log("✅ Check 8 passed: Advanced state from 6 to 1 successfully.");
    } else {
      throw new Error("Check 8 failed: Advanced state from 6 returned: " + advData.midday_next_movement);
    }

    // --- CHECK 9: cross-user isolation ---
    console.log("\nChecking Check 9: Cross-user isolation blocked...");
    const { status: badStatus } = await callFn("prayers-read", {
      email: "unregistered_steward_email@gmail.com",
      view: "mirror"
    });

    if (badStatus === 401) {
      console.log("✅ Check 9 passed: Unregistered email blocked with 401.");
    } else {
      throw new Error("Check 9 failed: Unregistered email returned status " + badStatus);
    }

    // --- CHECK: prayers-write operations ---
    console.log("\nTesting prayers-write operations...");
    // 1. Create a prayer
    const { status: cStatus, data: pCreate } = await callFn("prayers-write", {
      email: testEmail,
      action: "create",
      body: "Test open private prayer",
      category: "household"
    });

    if (cStatus !== 200 || !pCreate.id) {
      throw new Error(`Create prayer failed: ${JSON.stringify(pCreate)}`);
    }
    console.log("✅ Created prayer successfully:", pCreate.id);

    // 2. Reject unaware publish
    const { status: badPubStatus, data: badPubData } = await callFn("prayers-write", {
      email: testEmail,
      action: "create",
      body: "Unaware test prayer",
      category: "unaware"
    });

    const { status: pubStatus, data: pPubData } = await callFn("prayers-write", {
      email: testEmail,
      action: "publish",
      id: badPubData.id,
      display_mode: "anonymous"
    });

    if (pubStatus === 400 && pPubData.error.includes("unaware")) {
      console.log("✅ Rejected publishing unaware category prayer successfully.");
    } else {
      throw new Error(`Check 2 failed: Allowed publishing unaware prayer: status ${pubStatus}, data ${JSON.stringify(pPubData)}`);
    }

    // 3. Reject close without outcome
    const { status: badCloseStatus, data: badCloseData } = await callFn("prayers-write", {
      email: testEmail,
      action: "close",
      id: pCreate.id,
      state: "yes",
      outcome: "" // missing outcome
    });

    if (badCloseStatus === 400) {
      console.log("✅ Rejected closing prayer without outcome successfully.");
    } else {
      throw new Error(`Check 3 failed: Allowed closing prayer without outcome: status ${badCloseStatus}`);
    }

    // 4. Update prayer body
    const { status: uStatus, data: pUpdate } = await callFn("prayers-write", {
      email: testEmail,
      action: "update",
      id: pCreate.id,
      body: "Updated test open private prayer"
    });

    if (uStatus !== 200 || pUpdate.body !== "Updated test open private prayer") {
      throw new Error(`Update prayer failed: ${JSON.stringify(pUpdate)}`);
    }
    console.log("✅ Updated prayer body successfully.");

    // 5. Pin and unpin
    const { data: pPinned } = await callFn("prayers-write", { email: testEmail, action: "pin", id: pCreate.id });
    if (!pPinned.pinned) throw new Error("Pin failed");
    const { data: pUnpinned } = await callFn("prayers-write", { email: testEmail, action: "unpin", id: pCreate.id });
    if (pUnpinned.pinned) throw new Error("Unpin failed");
    console.log("✅ Pin/Unpin actions verified successfully.");

    // 6. Close prayer
    const { status: closeStatus, data: pClosed } = await callFn("prayers-write", {
      email: testEmail,
      action: "close",
      id: pCreate.id,
      state: "yes",
      outcome: "Answered prayer successfully verified."
    });

    if (closeStatus !== 200 || pClosed.state !== "yes") {
      throw new Error(`Close prayer failed: ${JSON.stringify(pClosed)}`);
    }
    console.log("✅ Closed prayer successfully.");

    // 7. Reopen prayer
    const { status: reopenStatus, data: pReopened } = await callFn("prayers-write", {
      email: testEmail,
      action: "reopen",
      id: pCreate.id
    });

    if (reopenStatus !== 200 || pReopened.state !== "not_yet") {
      throw new Error(`Reopen prayer failed: ${JSON.stringify(pReopened)}`);
    }
    console.log("✅ Reopened prayer successfully.");

    console.log("\n=== ALL EDGE FUNCTIONS COMPLIANCE CHECKS PASSED ===");
    process.exit(0);
  } catch (err) {
    console.error("Test failed:", err.message);
    process.exit(1);
  }
})();
