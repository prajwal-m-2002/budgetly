import type { Transaction, Account } from "../src/types/database";
import { computeAnalyticsFromTransactions } from "../src/lib/analytics";

function runAccountIsolationTests() {
  console.log("=================================================");
  console.log("Budgetly: Secondary Expense Accounts Verification");
  console.log("=================================================\n");

  const results: Record<string, "PASS" | "FAIL"> = {};

  // Mock Accounts
  const sbiMainAccount: Account = {
    id: "acc-sbi-main",
    user_id: "user-1",
    name: "SBI",
    type: "MAIN",
    icon: "🏦",
    color: "#3b82f6",
    is_active: true,
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
  };

  const kotakSecondaryAccount: Account = {
    id: "acc-kotak-sec",
    user_id: "user-1",
    name: "Kotak",
    type: "SECONDARY",
    icon: "🏛️",
    color: "#ef4444",
    is_active: true,
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
  };

  const accounts = [sbiMainAccount, kotakSecondaryAccount];
  const secondaryAccountIds = new Set(accounts.filter((a) => a.type === "SECONDARY").map((a) => a.id));

  // Helper to compute dashboard main summary
  function calculateMainDashboardSummary(txns: Transaction[]) {
    const mainTxns = txns.filter((t) => {
      if (t.account_id && secondaryAccountIds.has(t.account_id)) return false;
      return true;
    });

    const totalExpense = mainTxns
      .filter((t) => t.type === "expense")
      .reduce((s, t) => s + Number(t.amount), 0);
    const totalIncome = mainTxns
      .filter((t) => t.type === "income")
      .reduce((s, t) => s + Number(t.amount), 0);

    return { totalExpense, totalIncome, balance: totalIncome - totalExpense };
  }

  // Helper to compute specific account totals
  function calculateAccountTotal(txns: Transaction[], accountId: string) {
    const accTxns = txns.filter((t) => t.account_id === accountId);
    const totalExpense = accTxns
      .filter((t) => t.type === "expense")
      .reduce((s, t) => s + Number(t.amount), 0);
    const totalIncome = accTxns
      .filter((t) => t.type === "income")
      .reduce((s, t) => s + Number(t.amount), 0);

    return { totalExpense, totalIncome, balance: totalIncome - totalExpense, count: accTxns.length };
  }

  // Initial Data: Legacy / SBI transactions (Food ₹2,000, Travel ₹1,000, Shopping ₹500 = ₹3,500)
  let transactions: Transaction[] = [
    {
      id: "txn-1",
      user_id: "user-1",
      type: "expense",
      amount: 2000,
      date: "2026-09-20",
      time: null,
      description: "Food Grocery",
      category_id: "cat-food",
      account_id: sbiMainAccount.id,
      received_from: null,
      note: null,
      is_recurring: false,
      recurring_interval: null,
      created_at: "2026-09-20T10:00:00Z",
      updated_at: "2026-09-20T10:00:00Z",
      deleted_at: null,
      accounts: sbiMainAccount,
    },
    {
      id: "txn-2",
      user_id: "user-1",
      type: "expense",
      amount: 1000,
      date: "2026-09-21",
      time: null,
      description: "Travel Fuel",
      category_id: "cat-travel",
      account_id: sbiMainAccount.id,
      received_from: null,
      note: null,
      is_recurring: false,
      recurring_interval: null,
      created_at: "2026-09-21T10:00:00Z",
      updated_at: "2026-09-21T10:00:00Z",
      deleted_at: null,
      accounts: sbiMainAccount,
    },
    {
      id: "txn-3",
      user_id: "user-1",
      type: "expense",
      amount: 500,
      date: "2026-09-22",
      time: null,
      description: "Shopping Clothes",
      category_id: "cat-shop",
      account_id: null, // Legacy unassigned transaction -> must belong to Main Account
      received_from: null,
      note: null,
      is_recurring: false,
      recurring_interval: null,
      created_at: "2026-09-22T10:00:00Z",
      updated_at: "2026-09-22T10:00:00Z",
      deleted_at: null,
      accounts: sbiMainAccount,
    },
  ];

  // Test 1: Initial Main Total is ₹3,500
  const initialMain = calculateMainDashboardSummary(transactions);
  results["Scenario 0: Initial Main Total = ₹3,500"] = initialMain.totalExpense === 3500 ? "PASS" : "FAIL";

  // Test 2: Add ₹500 SBI expense -> main total increases to ₹4,000
  const newSbiTxn: Transaction = {
    id: "txn-sbi-new",
    user_id: "user-1",
    type: "expense",
    amount: 500,
    date: "2026-09-27",
    time: null,
    description: "SBI Dinner",
    category_id: "cat-food",
    account_id: sbiMainAccount.id,
    received_from: null,
    note: null,
    is_recurring: false,
    recurring_interval: null,
    created_at: "2026-09-27T10:00:00Z",
    updated_at: "2026-09-27T10:00:00Z",
    deleted_at: null,
    accounts: sbiMainAccount,
  };
  transactions.push(newSbiTxn);
  const afterSbi = calculateMainDashboardSummary(transactions);
  results["Scenario 1: Add ₹500 SBI expense -> Main total increases by ₹500 (₹4,000)"] =
    afterSbi.totalExpense === 4000 ? "PASS" : "FAIL";

  // Test 3: Add ₹500 Kotak expense -> Main total does NOT change (stays ₹4,000)
  const kotakTxn1: Transaction = {
    id: "txn-kotak-1",
    user_id: "user-1",
    type: "expense",
    amount: 500,
    date: "2026-09-27",
    time: null,
    description: "Kotak Food",
    category_id: "cat-food",
    account_id: kotakSecondaryAccount.id,
    received_from: null,
    note: null,
    is_recurring: false,
    recurring_interval: null,
    created_at: "2026-09-27T11:00:00Z",
    updated_at: "2026-09-27T11:00:00Z",
    deleted_at: null,
    accounts: kotakSecondaryAccount,
  };
  transactions.push(kotakTxn1);
  const afterKotak1 = calculateMainDashboardSummary(transactions);
  results["Scenario 2: Add ₹500 Kotak expense -> Main total does NOT change (still ₹4,000)"] =
    afterKotak1.totalExpense === 4000 ? "PASS" : "FAIL";

  // Test 4: Kotak total is now ₹500
  const kotakTotal1 = calculateAccountTotal(transactions, kotakSecondaryAccount.id);
  results["Scenario 3: Kotak total increases to ₹500"] = kotakTotal1.totalExpense === 500 ? "PASS" : "FAIL";

  // Test 5: Add ₹1,000 Kotak Shopping expense
  const kotakTxn2: Transaction = {
    id: "txn-kotak-2",
    user_id: "user-1",
    type: "expense",
    amount: 1000,
    date: "2026-09-27",
    time: null,
    description: "Kotak Shopping",
    category_id: "cat-shop",
    account_id: kotakSecondaryAccount.id,
    received_from: null,
    note: null,
    is_recurring: false,
    recurring_interval: null,
    created_at: "2026-09-27T12:00:00Z",
    updated_at: "2026-09-27T12:00:00Z",
    deleted_at: null,
    accounts: kotakSecondaryAccount,
  };
  transactions.push(kotakTxn2);
  const afterKotak2 = calculateMainDashboardSummary(transactions);
  const kotakTotal2 = calculateAccountTotal(transactions, kotakSecondaryAccount.id);
  results["Scenario 4: Add ₹1,000 Kotak Shopping -> Main stays ₹4,000, Kotak becomes ₹1,500"] =
    afterKotak2.totalExpense === 4000 && kotakTotal2.totalExpense === 1500 ? "PASS" : "FAIL";

  // Test 6: Edit Kotak expense (change ₹500 to ₹700) -> only Kotak total changes to ₹1,700, Main remains ₹4,000
  transactions = transactions.map((t) => (t.id === "txn-kotak-1" ? { ...t, amount: 700 } : t));
  const afterKotakEdit = calculateMainDashboardSummary(transactions);
  const kotakTotalAfterEdit = calculateAccountTotal(transactions, kotakSecondaryAccount.id);
  results["Scenario 5: Edit Kotak expense to ₹700 -> Main total unchanged (₹4,000), Kotak becomes ₹1,700"] =
    afterKotakEdit.totalExpense === 4000 && kotakTotalAfterEdit.totalExpense === 1700 ? "PASS" : "FAIL";

  // Test 7: Delete Kotak expense (remove txn-kotak-1) -> only Kotak total changes to ₹1,000, Main remains ₹4,000
  transactions = transactions.filter((t) => t.id !== "txn-kotak-1");
  const afterKotakDelete = calculateMainDashboardSummary(transactions);
  const kotakTotalAfterDelete = calculateAccountTotal(transactions, kotakSecondaryAccount.id);
  results["Scenario 6: Delete Kotak expense -> Main total unchanged (₹4,000), Kotak becomes ₹1,000"] =
    afterKotakDelete.totalExpense === 4000 && kotakTotalAfterDelete.totalExpense === 1000 ? "PASS" : "FAIL";

  // Test 8: Analytics Category Breakdown for Main Account
  const mainTxnsForAnalytics = transactions.filter((t) => !t.account_id || t.account_id === sbiMainAccount.id);
  const mainAnalytics = computeAnalyticsFromTransactions(mainTxnsForAnalytics);
  results["Scenario 7: Main Analytics total expenses matches Main total (₹4,000)"] =
    mainAnalytics.totalExpense === 4000 ? "PASS" : "FAIL";

  // Test 9: Analytics for Kotak Account
  const kotakTxnsForAnalytics = transactions.filter((t) => t.account_id === kotakSecondaryAccount.id);
  const kotakAnalytics = computeAnalyticsFromTransactions(kotakTxnsForAnalytics);
  results["Scenario 8: Kotak Analytics total expenses matches Kotak total (₹1,000)"] =
    kotakAnalytics.totalExpense === 1000 ? "PASS" : "FAIL";

  // Print Results
  console.log("Test Summary Results:\n");
  let passCount = 0;
  let totalTests = 0;
  for (const [desc, status] of Object.entries(results)) {
    totalTests++;
    if (status === "PASS") passCount++;
    console.log(`[${status}] ${desc}`);
  }

  console.log(`\nPassed ${passCount} / ${totalTests} test cases.`);
  if (passCount === totalTests) {
    console.log("ALL SECONDARY EXPENSE ACCOUNT ISOLATION TESTS PASSED!");
  } else {
    process.exit(1);
  }
}

runAccountIsolationTests();
