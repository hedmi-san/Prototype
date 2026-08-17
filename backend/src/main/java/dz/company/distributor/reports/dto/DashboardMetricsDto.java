package dz.company.distributor.reports.dto;

import dz.company.distributor.inventory.dto.StockMovementDto;
import dz.company.distributor.sales.dto.SaleDto;
import java.math.BigDecimal;
import java.util.List;

public class DashboardMetricsDto {

    private BigDecimal totalStockValue;
    private BigDecimal salesToday;
    private BigDecimal salesThisMonth;
    private int outOfStockCount;
    private int lowStockCount;
    private BigDecimal totalExpensesThisMonth;
    private BigDecimal totalSalariesThisMonth;
    private BigDecimal totalRevenueThisMonth;
    private BigDecimal grossProfitThisMonth;
    private BigDecimal netProfitThisMonth;
    private int pendingTransfersCount;
    private List<WarehouseComparisonDto> warehouseComparisons;
    private List<SaleDto> recentSales;
    private List<StockMovementDto> recentMovements;

    public DashboardMetricsDto() {}

    public BigDecimal getTotalStockValue() {
        return totalStockValue;
    }

    public void setTotalStockValue(BigDecimal totalStockValue) {
        this.totalStockValue = totalStockValue;
    }

    public BigDecimal getSalesToday() {
        return salesToday;
    }

    public void setSalesToday(BigDecimal salesToday) {
        this.salesToday = salesToday;
    }

    public BigDecimal getSalesThisMonth() {
        return salesThisMonth;
    }

    public void setSalesThisMonth(BigDecimal salesThisMonth) {
        this.salesThisMonth = salesThisMonth;
    }

    public int getOutOfStockCount() {
        return outOfStockCount;
    }

    public void setOutOfStockCount(int outOfStockCount) {
        this.outOfStockCount = outOfStockCount;
    }

    public int getLowStockCount() {
        return lowStockCount;
    }

    public void setLowStockCount(int lowStockCount) {
        this.lowStockCount = lowStockCount;
    }

    public BigDecimal getTotalExpensesThisMonth() {
        return totalExpensesThisMonth;
    }

    public void setTotalExpensesThisMonth(BigDecimal totalExpensesThisMonth) {
        this.totalExpensesThisMonth = totalExpensesThisMonth;
    }

    public BigDecimal getTotalSalariesThisMonth() {
        return totalSalariesThisMonth;
    }

    public void setTotalSalariesThisMonth(BigDecimal totalSalariesThisMonth) {
        this.totalSalariesThisMonth = totalSalariesThisMonth;
    }

    public BigDecimal getTotalRevenueThisMonth() {
        return totalRevenueThisMonth;
    }

    public void setTotalRevenueThisMonth(BigDecimal totalRevenueThisMonth) {
        this.totalRevenueThisMonth = totalRevenueThisMonth;
    }

    public BigDecimal getGrossProfitThisMonth() {
        return grossProfitThisMonth;
    }

    public void setGrossProfitThisMonth(BigDecimal grossProfitThisMonth) {
        this.grossProfitThisMonth = grossProfitThisMonth;
    }

    public BigDecimal getNetProfitThisMonth() {
        return netProfitThisMonth;
    }

    public void setNetProfitThisMonth(BigDecimal netProfitThisMonth) {
        this.netProfitThisMonth = netProfitThisMonth;
    }

    public int getPendingTransfersCount() {
        return pendingTransfersCount;
    }

    public void setPendingTransfersCount(int pendingTransfersCount) {
        this.pendingTransfersCount = pendingTransfersCount;
    }

    public List<WarehouseComparisonDto> getWarehouseComparisons() {
        return warehouseComparisons;
    }

    public void setWarehouseComparisons(List<WarehouseComparisonDto> warehouseComparisons) {
        this.warehouseComparisons = warehouseComparisons;
    }

    public List<SaleDto> getRecentSales() {
        return recentSales;
    }

    public void setRecentSales(List<SaleDto> recentSales) {
        this.recentSales = recentSales;
    }

    public List<StockMovementDto> getRecentMovements() {
        return recentMovements;
    }

    public void setRecentMovements(List<StockMovementDto> recentMovements) {
        this.recentMovements = recentMovements;
    }
}
