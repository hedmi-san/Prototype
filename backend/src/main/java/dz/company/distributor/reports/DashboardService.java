package dz.company.distributor.reports;

import dz.company.distributor.expenses.Expense;
import dz.company.distributor.expenses.ExpenseRepository;
import dz.company.distributor.inventory.InventoryService;
import dz.company.distributor.inventory.Stock;
import dz.company.distributor.inventory.StockRepository;
import dz.company.distributor.reports.dto.DashboardMetricsDto;
import dz.company.distributor.reports.dto.WarehouseComparisonDto;
import dz.company.distributor.salaries.SalaryRecord;
import dz.company.distributor.salaries.SalaryRepository;
import dz.company.distributor.sales.Sale;
import dz.company.distributor.sales.SaleItem;
import dz.company.distributor.sales.SaleRepository;
import dz.company.distributor.sales.SaleStatus;
import dz.company.distributor.sales.dto.SaleDto;
import dz.company.distributor.security.SecurityUtils;
import dz.company.distributor.transfers.TransferRepository;
import dz.company.distributor.transfers.TransferStatus;
import dz.company.distributor.warehouses.Warehouse;
import dz.company.distributor.warehouses.WarehouseRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class DashboardService {

    private final StockRepository stockRepository;
    private final SaleRepository saleRepository;
    private final ExpenseRepository expenseRepository;
    private final SalaryRepository salaryRepository;
    private final TransferRepository transferRepository;
    private final WarehouseRepository warehouseRepository;
    private final InventoryService inventoryService;

    public DashboardService(
            StockRepository stockRepository,
            SaleRepository saleRepository,
            ExpenseRepository expenseRepository,
            SalaryRepository salaryRepository,
            TransferRepository transferRepository,
            WarehouseRepository warehouseRepository,
            InventoryService inventoryService
    ) {
        this.stockRepository = stockRepository;
        this.saleRepository = saleRepository;
        this.expenseRepository = expenseRepository;
        this.salaryRepository = salaryRepository;
        this.transferRepository = transferRepository;
        this.warehouseRepository = warehouseRepository;
        this.inventoryService = inventoryService;
    }

    @Transactional(readOnly = true)
    public DashboardMetricsDto getDashboardMetrics(Long warehouseId) {
        if (warehouseId != null && !SecurityUtils.isAdmin() && !SecurityUtils.isSuperManager()) {
            SecurityUtils.validateWarehouseAccess(warehouseId);
        }

        DashboardMetricsDto metrics = new DashboardMetricsDto();

        LocalDateTime startOfToday = LocalDate.now().atStartOfDay();
        LocalDateTime endOfToday = LocalDate.now().atTime(LocalTime.MAX);
        LocalDateTime startOfMonth = LocalDate.now().withDayOfMonth(1).atStartOfDay();
        String currentPeriod = YearMonth.now().format(DateTimeFormatter.ofPattern("yyyy-MM"));

        // 1. Stock Metrics & Valuation (Valuation = physical_quantity * current product purchase_price)
        List<Stock> stockList = (warehouseId != null)
                ? stockRepository.findByWarehouseId(warehouseId)
                : stockRepository.findAll();

        BigDecimal totalStockValuation = BigDecimal.ZERO;
        int outOfStock = 0;
        int lowStock = 0;

        for (Stock stock : stockList) {
            BigDecimal itemValuation = stock.getProduct().getPurchasePrice().multiply(BigDecimal.valueOf(stock.getPhysicalQuantity()));
            totalStockValuation = totalStockValuation.add(itemValuation);

            int available = stock.getAvailableQuantity();
            if (available == 0) {
                outOfStock++;
            } else if (available <= 10) {
                lowStock++;
            }
        }
        metrics.setTotalStockValue(totalStockValuation);
        metrics.setOutOfStockCount(outOfStock);
        metrics.setLowStockCount(lowStock);

        // 2. Sales Metrics
        List<Sale> allSales = (warehouseId != null)
                ? saleRepository.findByWarehouseIdOrderBySaleDateDesc(warehouseId)
                : saleRepository.findAllByOrderBySaleDateDesc();

        BigDecimal salesToday = BigDecimal.ZERO;
        BigDecimal salesMonth = BigDecimal.ZERO;
        BigDecimal costOfGoodsSoldMonth = BigDecimal.ZERO;

        for (Sale sale : allSales) {
            if (sale.getStatus() == SaleStatus.COMPLETED) {
                if (!sale.getSaleDate().isBefore(startOfToday) && !sale.getSaleDate().isAfter(endOfToday)) {
                    salesToday = salesToday.add(sale.getTotalAmount());
                }
                if (!sale.getSaleDate().isBefore(startOfMonth)) {
                    salesMonth = salesMonth.add(sale.getTotalAmount());

                    // Calculate COGS for month
                    for (SaleItem item : sale.getItems()) {
                        BigDecimal cogsItem = item.getProduct().getPurchasePrice().multiply(BigDecimal.valueOf(item.getQuantity()));
                        costOfGoodsSoldMonth = costOfGoodsSoldMonth.add(cogsItem);
                    }
                }
            }
        }
        metrics.setSalesToday(salesToday);
        metrics.setSalesThisMonth(salesMonth);
        metrics.setTotalRevenueThisMonth(salesMonth);

        BigDecimal grossProfitMonth = salesMonth.subtract(costOfGoodsSoldMonth);
        metrics.setGrossProfitThisMonth(grossProfitMonth);

        // 3. Expenses Metrics
        List<Expense> expenses = (warehouseId != null)
                ? expenseRepository.findByWarehouseIdOrderByExpenseDateDesc(warehouseId)
                : expenseRepository.findAllByOrderByExpenseDateDesc();

        LocalDate firstDayOfMonth = LocalDate.now().withDayOfMonth(1);
        BigDecimal totalExpensesMonth = BigDecimal.ZERO;
        for (Expense expense : expenses) {
            if (!expense.getExpenseDate().isBefore(firstDayOfMonth)) {
                totalExpensesMonth = totalExpensesMonth.add(expense.getAmount());
            }
        }
        metrics.setTotalExpensesThisMonth(totalExpensesMonth);

        // 4. Salaries Metrics
        List<SalaryRecord> salaryRecords = (warehouseId != null)
                ? salaryRepository.findByWarehouseIdAndPeriod(warehouseId, currentPeriod)
                : salaryRepository.findByPeriod(currentPeriod);

        BigDecimal totalSalariesMonth = BigDecimal.ZERO;
        for (SalaryRecord salary : salaryRecords) {
            totalSalariesMonth = totalSalariesMonth.add(salary.getTotalAmount());
        }
        metrics.setTotalSalariesThisMonth(totalSalariesMonth);

        // 5. Net Profit = Gross Profit - Expenses - Salaries
        BigDecimal netProfit = grossProfitMonth.subtract(totalExpensesMonth).subtract(totalSalariesMonth);
        metrics.setNetProfitThisMonth(netProfit);

        // 6. Pending Transfers Count
        int pendingTransfers = (int) transferRepository.findByStatus(TransferStatus.REQUESTED).size();
        metrics.setPendingTransfersCount(pendingTransfers);

        // 7. Recent Movements & Sales
        metrics.setRecentMovements(inventoryService.getMovements(warehouseId).stream().limit(6).collect(Collectors.toList()));
        metrics.setRecentSales(allSales.stream().limit(6).map(this::mapSaleToDto).collect(Collectors.toList()));

        // 8. Multi-Warehouse Comparison (For Admin View)
        if (warehouseId == null) {
            List<WarehouseComparisonDto> comparisons = new ArrayList<>();
            List<Warehouse> warehouses = warehouseRepository.findAll();

            for (Warehouse wh : warehouses) {
                List<Stock> whStock = stockRepository.findByWarehouseId(wh.getId());
                BigDecimal whStockVal = BigDecimal.ZERO;
                for (Stock s : whStock) {
                    whStockVal = whStockVal.add(s.getProduct().getPurchasePrice().multiply(BigDecimal.valueOf(s.getPhysicalQuantity())));
                }

                List<Sale> whSales = saleRepository.findByWarehouseIdOrderBySaleDateDesc(wh.getId());
                BigDecimal whSalesMonth = BigDecimal.ZERO;
                for (Sale s : whSales) {
                    if (s.getStatus() == SaleStatus.COMPLETED && !s.getSaleDate().isBefore(startOfMonth)) {
                        whSalesMonth = whSalesMonth.add(s.getTotalAmount());
                    }
                }

                List<Expense> whExp = expenseRepository.findByWarehouseIdOrderByExpenseDateDesc(wh.getId());
                BigDecimal whExpMonth = BigDecimal.ZERO;
                for (Expense e : whExp) {
                    if (!e.getExpenseDate().isBefore(firstDayOfMonth)) {
                        whExpMonth = whExpMonth.add(e.getAmount());
                    }
                }

                List<SalaryRecord> whSal = salaryRepository.findByWarehouseIdAndPeriod(wh.getId(), currentPeriod);
                BigDecimal whSalMonth = BigDecimal.ZERO;
                for (SalaryRecord sr : whSal) {
                    whSalMonth = whSalMonth.add(sr.getTotalAmount());
                }

                comparisons.add(new WarehouseComparisonDto(
                        wh.getId(),
                        wh.getName(),
                        wh.getCode(),
                        whStockVal,
                        whStock.size(),
                        whSalesMonth,
                        whExpMonth,
                        whSalMonth
                ));
            }
            metrics.setWarehouseComparisons(comparisons);
        }

        return metrics;
    }

    private SaleDto mapSaleToDto(Sale sale) {
        return new SaleDto(
                sale.getId(),
                sale.getWarehouse().getId(),
                sale.getWarehouse().getName(),
                sale.getWarehouse().getCode(),
                sale.getInvoiceNumber(),
                sale.getCustomerName(),
                sale.getCustomerPhone(),
                sale.getTotalAmount(),
                sale.getSaleDate(),
                sale.getStatus(),
                sale.getCreatedBy() != null ? sale.getCreatedBy().getId() : null,
                sale.getCreatedBy() != null ? sale.getCreatedBy().getFullName() : "System",
                null,
                sale.getCreatedAt(),
                sale.getUpdatedAt()
        );
    }
}
