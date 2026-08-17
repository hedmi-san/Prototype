package dz.company.distributor.reports.dto;

import dz.company.distributor.inventory.dto.StockDto;
import java.math.BigDecimal;
import java.util.List;

public class StockValuationReportDto {
    private Long warehouseId;
    private String warehouseName;
    private BigDecimal totalValuation;
    private int totalPhysicalUnits;
    private int totalReservedUnits;
    private int totalAvailableUnits;
    private List<StockDto> items;

    public StockValuationReportDto() {}

    public StockValuationReportDto(Long warehouseId, String warehouseName, BigDecimal totalValuation, int totalPhysicalUnits, int totalReservedUnits, int totalAvailableUnits, List<StockDto> items) {
        this.warehouseId = warehouseId;
        this.warehouseName = warehouseName;
        this.totalValuation = totalValuation;
        this.totalPhysicalUnits = totalPhysicalUnits;
        this.totalReservedUnits = totalReservedUnits;
        this.totalAvailableUnits = totalAvailableUnits;
        this.items = items;
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

    public BigDecimal getTotalValuation() {
        return totalValuation;
    }

    public void setTotalValuation(BigDecimal totalValuation) {
        this.totalValuation = totalValuation;
    }

    public int getTotalPhysicalUnits() {
        return totalPhysicalUnits;
    }

    public void setTotalPhysicalUnits(int totalPhysicalUnits) {
        this.totalPhysicalUnits = totalPhysicalUnits;
    }

    public int getTotalReservedUnits() {
        return totalReservedUnits;
    }

    public void setTotalReservedUnits(int totalReservedUnits) {
        this.totalReservedUnits = totalReservedUnits;
    }

    public int getTotalAvailableUnits() {
        return totalAvailableUnits;
    }

    public void setTotalAvailableUnits(int totalAvailableUnits) {
        this.totalAvailableUnits = totalAvailableUnits;
    }

    public List<StockDto> getItems() {
        return items;
    }

    public void setItems(List<StockDto> items) {
        this.items = items;
    }
}
