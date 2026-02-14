# Billji User Guide

Welcome to Billji! This guide will help you get started with managing your accounting and inventory efficiently.

## Getting Started

### 1. Create an Account

1. Visit the Billji website
2. Click "Sign up" on the login page
3. Choose one of the following methods:
   - **Email/Password**: Enter your email and create a password
   - **Google Sign-In**: Click the "Sign up with Google" button

### 2. First Login

After signing up, you'll be taken to the Dashboard, which shows an overview of your business finances.

## Dashboard Overview

The Dashboard displays:

- **Total Income**: Sum of all revenue
- **Total Expenses**: Sum of all costs
- **Net Profit/Loss**: Automatically calculated (Income - Expenses)
  - Green = Profit
  - Red = Loss
- **Low Stock Items**: Products that need restocking
- **Recent Transactions**: Your latest 5 transactions

## Managing Transactions

### Adding Income

1. Click on "Transactions" in the sidebar
2. Click "+ Add Transaction" button
3. Select "Income" as the type
4. Fill in the details:
   - **Category**: Select from dropdown (Product Sales, Service Revenue, etc.)
   - **Amount**: Enter the amount received
   - **Date**: Select transaction date
   - **GST Rate**: Default is 18%, adjust if needed
   - **Description** (Optional): Add notes about this income
5. Click "Add Transaction"

### Adding Expenses

1. Click on "Transactions" in the sidebar
2. Click "+ Add Transaction" button
3. Select "Expense" as the type
4. Fill in the details:
   - **Category**: Select from dropdown (Supplier Costs, Marketing, Utilities, etc.)
   - **Amount**: Enter the expense amount
   - **Date**: Select transaction date
   - **GST Rate**: Default is 18%, adjust if needed
   - **Description** (Optional): Add notes about this expense
5. Click "Add Transaction"

### Viewing and Filtering Transactions

- **Filter by Type**: Click "All", "Income", or "Expense" buttons
- **Search**: Use the search box to find transactions by description or category
- **Edit**: Click the pencil icon to modify a transaction
- **Delete**: Click the trash icon to remove a transaction

## Managing Inventory

### Adding Products

1. Click on "Inventory" in the sidebar
2. Click "+ Add Product" button
3. Fill in product details:
   - **Product Name**: Enter the product name
   - **SKU**: Auto-generated, but you can customize it
   - **Quantity**: Current stock level
   - **Purchase Price**: How much you paid for each unit
   - **Selling Price**: How much you sell each unit for
   - **Low Stock Threshold**: Alert when stock falls below this number (default: 10)
4. Click "Add Product"

The app automatically calculates and shows your profit margin percentage.

### Managing Stock

- **View Products**: See all products with their stock levels
- **Filter by Status**: 
  - **All**: Show all products
  - **In Stock**: Products above low stock threshold
  - **Low Stock**: Products at or below threshold (with orange warning)
  - **Out of Stock**: Products with 0 quantity (with red warning)
- **Search**: Find products by name or SKU
- **Edit**: Update product details, prices, or stock levels
- **Delete**: Remove products from inventory

### Low Stock Alerts

- Products below the low stock threshold show an orange "Low Stock" badge
- The Dashboard shows a count of low stock items
- Address low stock by editing the product and increasing the quantity

## Creating Invoices

### Generate an Invoice

1. Click on "Invoices" in the sidebar
2. Click "+ Create Invoice" button
3. Fill in customer information:
   - **Customer Name** (Required)
   - **Customer Email** (Optional)
   - **Customer Address** (Optional)
4. Set dates:
   - **Invoice Date**: Date invoice is created
   - **Due Date**: Payment deadline
5. Add line items:
   - Click "+ Add Item" for each product/service
   - Enter description, quantity, and price
   - Click "Remove" to delete a line item
6. Configure tax:
   - **GST Rate**: Adjust if needed (default 18%)
7. Set payment status:
   - **Unpaid**: Invoice not yet paid (orange)
   - **Paid**: Invoice paid (green)
   - **Overdue**: Payment is late (red)
8. Add notes (optional): Payment terms, thank you message, etc.
9. Click "Create Invoice"

### Managing Invoices

- View all invoices in a table format
- See invoice number, customer, dates, total, and status
- **Download PDF**: Click download icon to get printable invoice
- **Edit**: Click pencil icon to modify invoice
- **Delete**: Click trash icon to remove invoice

### Invoice PDFs

Downloaded invoices include:
- Your company name (Billji)
- Invoice number and dates
- Customer details
- Itemized line items
- Subtotal, GST amount, and total
- Notes and payment terms
- Professional formatting for printing

## Reports & Analytics

### Viewing Reports

1. Click on "Reports" in the sidebar
2. Select date range:
   - Use the date pickers to set Start and End dates
   - Or click quick filters: "This Month", "Last 30 Days"

### Report Types

#### Profit & Loss Statement

- **Total Income**: Sum of all revenue in date range
- **Total Expenses**: Sum of all costs in date range
- **Net Profit/Loss**: Calculated automatically

#### Expense Breakdown (Pie Chart)

- Visual representation of expenses by category
- Hover over sections to see exact amounts
- Helps identify where most money is spent

#### Income Breakdown (Pie Chart)

- Visual representation of income by category
- Shows revenue sources at a glance

#### Income vs Expenses (Bar Chart)

- 6-month trend showing income and expenses side by side
- Helps visualize business performance over time

#### Inventory Valuation

- **Purchase Value**: Total value at buying price
- **Selling Value**: Total value at selling price
- **Potential Profit**: Difference between the two

### Exporting Reports

- **Export PDF**: Click "Export PDF" for printable P&L statement
- **Export CSV**: Click "Export CSV" for Excel-compatible data file

## Tips for Best Practices

### Daily Tasks

1. Add transactions as they occur
2. Check Dashboard for quick overview
3. Monitor low stock alerts

### Weekly Tasks

1. Review recent transactions for accuracy
2. Update inventory counts if physical stock changed
3. Follow up on unpaid invoices

### Monthly Tasks

1. Generate monthly P&L report
2. Analyze expense breakdown
3. Review inventory valuation
4. Plan for next month based on trends

### Data Entry Tips

- **Be Consistent**: Use the same categories for similar transactions
- **Add Descriptions**: Future you will thank you for clear notes
- **Regular Updates**: Update immediately to avoid forgetting details
- **Check Accuracy**: Double-check amounts before saving

## Security & Privacy

- Your data is stored securely in Firebase
- Each user's data is completely isolated (multi-tenant)
- Only you can see your transactions, products, and invoices
- Always log out when using a shared computer

## Troubleshooting

### Can't Log In

- Check your email and password are correct
- Try "Reset Password" if using email login
- Try Google Sign-In as alternative

### Data Not Showing

- Refresh the page
- Check your internet connection
- Make sure you're logged in

### Charts Not Loading

- Ensure you have transactions in the selected date range
- Try changing the date range
- Refresh the browser

## Getting Help

If you encounter issues or have questions:
- Review this user guide
- Check the README.md for technical details
-Contact support (see app footer)

## Keyboard Shortcuts

- **ESC**: Close open modals
- Navigate using tab key
- Enter to submit forms

---

**Made with ❤️ by Sudeepta Kumar Panda**
