// Function: getProfitLoss
// Path: src/main.js
import { Client, Databases, Query } from 'node-appwrite';

export default async ({ req, res, log, error }) => {
  log("Starting getProfitLoss function execution.");

  const APPWRITE_ENDPOINT = req.env['APPWRITE_ENDPOINT'];
  const APPWRITE_PROJECT = req.env['APPWRITE_PROJECT'];
  const APPWRITE_API_KEY = req.env['APPWRITE_API_KEY'];
  const APPWRITE_DATABASE_ID = req.env['APPWRITE_DATABASE_ID'];
  const ORDERS_COLLECTION_ID = req.env['ORDERS_COLLECTION_ID'];
  const EXPENSES_COLLECTION_ID = req.env['EXPENSES_COLLECTION_ID'];

  if (!APPWRITE_ENDPOINT || !APPWRITE_PROJECT || !APPWRITE_API_KEY || !APPWRITE_DATABASE_ID || !ORDERS_COLLECTION_ID || !EXPENSES_COLLECTION_ID) {
    error("Missing environment variables!");
    return res.json({
      ok: false,
      error: "Server configuration error: Missing Appwrite credentials or collection IDs."
    }, 500);
  }

  const client = new Client()
    .setEndpoint(APPWRITE_ENDPOINT)
    .setProject(APPWRITE_PROJECT)
    .setKey(APPWRITE_API_KEY);

  const databases = new Databases(client);

  let monthlyData = {}; // To store profit/expense per month
  const currentYear = new Date().getFullYear();

  try {
    // Fetch Orders (representing income/revenue)
    let ordersOffset = 0;
    const ordersLimit = 100;
    let hasMoreOrders = true;

    while (hasMoreOrders) {
      const ordersResponse = await databases.listDocuments(
        APPWRITE_DATABASE_ID,
        ORDERS_COLLECTION_ID,
        [Query.limit(ordersLimit), Query.offset(ordersOffset)]
      );

      ordersResponse.documents.forEach(order => {
        // Assuming 'totalAmount' is the revenue/income from an order
        // and 'orderDate' is the timestamp of the order
        const orderDate = new Date(order.orderDate);
        if (orderDate.getFullYear() === currentYear) {
          const month = orderDate.toLocaleString('default', { month: 'short' }); // e.g., "Jan"
          monthlyData[month] = monthlyData[month] || { month: month, profit: 0, expense: 0 };
          if (typeof order.totalAmount === 'number') {
            monthlyData[month].profit += order.totalAmount;
          }
        }
      });

      if (ordersResponse.documents.length < ordersLimit) {
        hasMoreOrders = false;
      } else {
        ordersOffset += ordersLimit;
      }
    }

    // Fetch Expenses
    let expensesOffset = 0;
    const expensesLimit = 100;
    let hasMoreExpenses = true;

    while (hasMoreExpenses) {
      const expensesResponse = await databases.listDocuments(
        APPWRITE_DATABASE_ID,
        EXPENSES_COLLECTION_ID,
        [Query.limit(expensesLimit), Query.offset(expensesOffset)]
      );

      expensesResponse.documents.forEach(expense => {
        // Assuming 'amount' is the expense amount and 'expenseDate' is the timestamp
        const expenseDate = new Date(expense.expenseDate);
        if (expenseDate.getFullYear() === currentYear) {
          const month = expenseDate.toLocaleString('default', { month: 'short' });
          monthlyData[month] = monthlyData[month] || { month: month, profit: 0, expense: 0 };
          if (typeof expense.amount === 'number') {
            monthlyData[month].expense += expense.amount;
          }
        }
      });

      if (expensesResponse.documents.length < expensesLimit) {
        hasMoreExpenses = false;
      } else {
        expensesOffset += expensesLimit;
      }
    }

    // Convert monthlyData object to an array for Recharts
    const monthsOrder = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const profitLossArray = monthsOrder
      .map(month => ({
        month: month,
        profit: monthlyData[month]?.profit || 0,
        expense: monthlyData[month]?.expense || 0,
      }))
      .filter(data => data.profit > 0 || data.expense > 0); // Only include months with data

    log(`Profit/Loss data generated for ${profitLossArray.length} months.`);

    return res.json({
      ok: true,
      monthlyData: profitLossArray,
      // You can also return overall totals if needed
      totalProfit: profitLossArray.reduce((sum, item) => sum + item.profit, 0),
      totalExpenses: profitLossArray.reduce((sum, item) => sum + item.expense, 0),
    }, 200);

  } catch (err) {
    error(`Failed to calculate profit/loss: ${err.message}`);
    return res.json({
      ok: false,
      error: `Failed to get profit/loss data: ${err.message}`
    }, 500);
  }
};