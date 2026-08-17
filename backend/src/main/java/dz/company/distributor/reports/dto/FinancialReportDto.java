package dz.company.distributor.reports.dto;

import java.math.BigDecimal;
import java.util.Map;

public class FinancialReportDto {
    private Long warehouseId;
    private String warehouseName;
    private String period; // YYYY-MM or 'ALL'
    private BigDecimal totalRevenue;
    private BigDecimal costOfGoodsSold;
    private BigDecimal grossProfit;
    private BigDecimal totalExpenses;
    private Map<String, BigDecimal> expensesByCategory;
    private BigDecimal totalSalaries;
    private BigDecimal netProfit;

    public FinancialReportDto() {}

    public Long getWarehouseId() {
        return warehouseId;
    }

    public void setWarehouseId(Long warehouseId) {
        this.warehouseId = warehouseId;
    }

    public String getWarehouseName() {
        return warehouseName;
    }

    public void setWarehouseName(String warehouseName) {
        this.warehouseName = warehouseName;
    }

    public String getPeriod() {
        return period;
    }

    public void setPeriod(String period) {
        this.period = period;
    }

    public BigDecimal getTotalRevenue() {
        return totalRevenue;
    }

    public void setTotalRevenue(BigDecimal totalRevenue) {
        this.totalRevenue = totalRevenue;
    }

    public BigDecimal getCostOfGoodsSold() {
        return costOfGoodsSold;
    }

    public void setCostOfGoodsSold(BigDecimal costOfGoodsSold) {
        this.costOfGoodsSold = costOfGoodsSold;
    }

    public BigDecimal getGrossProfit() {
        return grossProfit;
    }

    public void setGrossProfit(BigDecimal grossProfit) {
        this.grossProfit = grossProfit;
    }

    public BigDecimal getTotalExpenses() {
        return totalExpenses;
    }

    public void setTotalExpenses(BigDecimal totalExpenses) {
        this.totalExpenses = totalExpenses;
    }

    public Map<String, BigDecimal> getExpensesByCategory() {
        return expensesByCategory;
    }

    public void setExpensesByCategory(Map<String, BigDecimal> expensesByCategory) {
        this.expensesByCategory = expensesByCategory;
    }

    public BigDecimal getTotalSalaries() {
        return totalSalaries;
    }

    public void setTotalSalaries(BigDecimal totalSalaries) {
        this.totalSalaries = totalSalaries;
    }

    public BigDecimal getNetProfit() {
        return netProfit;
    }

    public void setNetProfit(BigDecimal netProfit) {
        this.netProfit = netProfit;
    }
}
