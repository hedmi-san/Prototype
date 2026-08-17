package dz.company.distributor.reports.dto;

import java.math.BigDecimal;

public class WarehouseComparisonDto {
    private Long warehouseId;
    private String warehouseName;
    private String warehouseCode;
    private BigDecimal stockValue;
    private int totalProductsCount;
    private BigDecimal monthlySales;
    private BigDecimal monthlyExpenses;
    private BigDecimal monthlySalaries;

    public WarehouseComparisonDto() {}

    public WarehouseComparisonDto(Long warehouseId, String warehouseName, String warehouseCode, BigDecimal stockValue, int totalProductsCount, BigDecimal monthlySales, BigDecimal monthlyExpenses, BigDecimal monthlySalaries) {
        this.warehouseId = warehouseId;
        this.warehouseName = warehouseName;
        this.warehouseCode = warehouseCode;
        this.stockValue = stockValue;
        this.totalProductsCount = totalProductsCount;
        this.monthlySales = monthlySales;
        this.monthlyExpenses = monthlyExpenses;
        this.monthlySalaries = monthlySalaries;
    }

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

    public String getWarehouseCode() {
        return warehouseCode;
    }

    public void setWarehouseCode(String warehouseCode) {
        this.warehouseCode = warehouseCode;
    }

    public BigDecimal getStockValue() {
        return stockValue;
    }

    public void setStockValue(BigDecimal stockValue) {
        this.stockValue = stockValue;
    }

    public int getTotalProductsCount() {
        return totalProductsCount;
    }

    public void setTotalProductsCount(int totalProductsCount) {
        this.totalProductsCount = totalProductsCount;
    }

    public BigDecimal getMonthlySales() {
        return monthlySales;
    }

    public void setMonthlySales(BigDecimal monthlySales) {
        this.monthlySales = monthlySales;
    }

    public BigDecimal getMonthlyExpenses() {
        return monthlyExpenses;
    }

    public void setMonthlyExpenses(BigDecimal monthlyExpenses) {
        this.monthlyExpenses = monthlyExpenses;
    }

    public BigDecimal getMonthlySalaries() {
        return monthlySalaries;
    }

    public void setMonthlySalaries(BigDecimal monthlySalaries) {
        this.monthlySalaries = monthlySalaries;
    }
}
