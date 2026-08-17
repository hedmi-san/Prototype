package dz.company.distributor.reports;

import dz.company.distributor.expenses.Expense;
import dz.company.distributor.expenses.ExpenseRepository;
import dz.company.distributor.reports.dto.FinancialReportDto;
import dz.company.distributor.salaries.SalaryRecord;
import dz.company.distributor.salaries.SalaryRepository;
import dz.company.distributor.sales.Sale;
import dz.company.distributor.sales.SaleItem;
import dz.company.distributor.sales.SaleRepository;
import dz.company.distributor.sales.SaleStatus;
import dz.company.distributor.security.SecurityUtils;
import dz.company.distributor.warehouses.Warehouse;
import dz.company.distributor.warehouses.WarehouseRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class FinancialReportService {

    private final SaleRepository saleRepository;
    private final ExpenseRepository expenseRepository;
    private final SalaryRepository salaryRepository;
    private final WarehouseRepository warehouseRepository;

    public FinancialReportService(
            SaleRepository saleRepository,
            ExpenseRepository expenseRepository,
            SalaryRepository salaryRepository,
            WarehouseRepository warehouseRepository
    ) {
        this.saleRepository = saleRepository;
        this.expenseRepository = expenseRepository;
        this.salaryRepository = salaryRepository;
        this.warehouseRepository = warehouseRepository;
    }

    @Transactional(readOnly = true)
    public FinancialReportDto getFinancialReport(Long warehouseId, String period) {
        if (warehouseId != null && !SecurityUtils.isAdmin()) {
            SecurityUtils.validateWarehouseAccess(warehouseId);
        }

        FinancialReportDto dto = new FinancialReportDto();
        dto.setWarehouseId(warehouseId);
        dto.setPeriod(period != null ? period : YearMonth.now().format(DateTimeFormatter.ofPattern("yyyy-MM")));

        String warehouseName = "All Warehouses Consolidated";
        if (warehouseId != null) {
            Warehouse wh = warehouseRepository.findById(warehouseId).orElse(null);
            if (wh != null) warehouseName = wh.getName();
        }
        dto.setWarehouseName(warehouseName);

        // Date range based on period YYYY-MM
        YearMonth ym = (period != null && period.matches("\\d{4}-\\d{2}")) 
                ? YearMonth.parse(period) 
                : YearMonth.now();
        LocalDateTime startOfMonth = ym.atDay(1).atStartOfDay();
        LocalDateTime endOfMonth = ym.atEndOfMonth().atTime(23, 59, 59);
        LocalDate startLocalDate = ym.atDay(1);
        LocalDate endLocalDate = ym.atEndOfMonth();

        // 1. Revenue & COGS from Sales
        List<Sale> sales = (warehouseId != null)
                ? saleRepository.findWarehouseSalesInDateRange(warehouseId, startOfMonth, endOfMonth)
                : saleRepository.findSalesInDateRange(startOfMonth, endOfMonth);

        BigDecimal revenue = BigDecimal.ZERO;
        BigDecimal cogs = BigDecimal.ZERO;

        for (Sale s : sales) {
            if (s.getStatus() == SaleStatus.COMPLETED) {
                revenue = revenue.add(s.getTotalAmount());
                for (SaleItem item : s.getItems()) {
                    cogs = cogs.add(item.getProduct().getPurchasePrice().multiply(BigDecimal.valueOf(item.getQuantity())));
                }
            }
        }
        dto.setTotalRevenue(revenue);
        dto.setCostOfGoodsSold(cogs);
        dto.setGrossProfit(revenue.subtract(cogs));

        // 2. Expenses & Breakdown
        List<Expense> expenses = (warehouseId != null)
                ? expenseRepository.findWarehouseExpensesInDateRange(warehouseId, startLocalDate, endLocalDate)
                : expenseRepository.findExpensesInDateRange(startLocalDate, endLocalDate);

        BigDecimal totalExpenses = BigDecimal.ZERO;
        Map<String, BigDecimal> expensesByCategory = new HashMap<>();

        for (Expense e : expenses) {
            totalExpenses = totalExpenses.add(e.getAmount());
            String cat = e.getCategory().name();
            expensesByCategory.put(cat, expensesByCategory.getOrDefault(cat, BigDecimal.ZERO).add(e.getAmount()));
        }
        dto.setTotalExpenses(totalExpenses);
        dto.setExpensesByCategory(expensesByCategory);

        // 3. Salaries
        String periodStr = ym.format(DateTimeFormatter.ofPattern("yyyy-MM"));
        List<SalaryRecord> salaries = (warehouseId != null)
                ? salaryRepository.findByWarehouseIdAndPeriod(warehouseId, periodStr)
                : salaryRepository.findByPeriod(periodStr);

        BigDecimal totalSalaries = BigDecimal.ZERO;
        for (SalaryRecord s : salaries) {
            totalSalaries = totalSalaries.add(s.getTotalAmount());
        }
        dto.setTotalSalaries(totalSalaries);

        // 4. Net Profit = Gross Profit - Total Expenses - Total Salaries
        BigDecimal netProfit = dto.getGrossProfit().subtract(totalExpenses).subtract(totalSalaries);
        dto.setNetProfit(netProfit);

        return dto;
    }
}
