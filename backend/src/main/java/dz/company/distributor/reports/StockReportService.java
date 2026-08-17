package dz.company.distributor.reports;

import dz.company.distributor.inventory.InventoryService;
import dz.company.distributor.inventory.Stock;
import dz.company.distributor.inventory.StockRepository;
import dz.company.distributor.inventory.dto.StockDto;
import dz.company.distributor.reports.dto.StockValuationReportDto;
import dz.company.distributor.security.SecurityUtils;
import dz.company.distributor.warehouses.Warehouse;
import dz.company.distributor.warehouses.WarehouseRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class StockReportService {

    private final StockRepository stockRepository;
    private final WarehouseRepository warehouseRepository;
    private final InventoryService inventoryService;

    public StockReportService(StockRepository stockRepository, WarehouseRepository warehouseRepository, InventoryService inventoryService) {
        this.stockRepository = stockRepository;
        this.warehouseRepository = warehouseRepository;
        this.inventoryService = inventoryService;
    }

    @Transactional(readOnly = true)
    public StockValuationReportDto getStockValuationReport(Long warehouseId) {
        if (warehouseId != null && !SecurityUtils.isAdmin() && !SecurityUtils.isSuperManager()) {
            SecurityUtils.validateWarehouseAccess(warehouseId);
        }

        List<Stock> stocks = (warehouseId != null)
                ? stockRepository.findByWarehouseId(warehouseId)
                : stockRepository.findAll();

        BigDecimal totalValuation = BigDecimal.ZERO;
        int totalPhysical = 0;
        int totalReserved = 0;
        int totalAvailable = 0;

        List<StockDto> items = stocks.stream().map(inventoryService::mapToDto).collect(Collectors.toList());

        for (StockDto item : items) {
            totalValuation = totalValuation.add(item.getTotalValuation());
            totalPhysical += item.getPhysicalQuantity();
            totalReserved += item.getReservedQuantity();
            totalAvailable += item.getAvailableQuantity();
        }

        String warehouseName = "All Warehouses Combined";
        if (warehouseId != null) {
            Warehouse wh = warehouseRepository.findById(warehouseId).orElse(null);
            if (wh != null) warehouseName = wh.getName();
        }

        return new StockValuationReportDto(
                warehouseId,
                warehouseName,
                totalValuation,
                totalPhysical,
                totalReserved,
                totalAvailable,
                items
        );
    }
}
