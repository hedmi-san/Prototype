package dz.company.distributor.reports;

import dz.company.distributor.sales.Sale;
import dz.company.distributor.sales.SaleRepository;
import dz.company.distributor.sales.SaleStatus;
import dz.company.distributor.sales.dto.SaleDto;
import dz.company.distributor.security.SecurityUtils;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class SalesReportService {

    private final SaleRepository saleRepository;

    public SalesReportService(SaleRepository saleRepository) {
        this.saleRepository = saleRepository;
    }

    @Transactional(readOnly = true)
    public List<SaleDto> getSalesReport(Long warehouseId, LocalDateTime startDate, LocalDateTime endDate) {
        if (warehouseId != null && !SecurityUtils.isAdmin()) {
            SecurityUtils.validateWarehouseAccess(warehouseId);
        }

        List<Sale> sales;
        if (startDate != null && endDate != null) {
            sales = (warehouseId != null)
                    ? saleRepository.findWarehouseSalesInDateRange(warehouseId, startDate, endDate)
                    : saleRepository.findSalesInDateRange(startDate, endDate);
        } else {
            sales = (warehouseId != null)
                    ? saleRepository.findByWarehouseIdOrderBySaleDateDesc(warehouseId)
                    : saleRepository.findAllByOrderBySaleDateDesc();
        }

        return sales.stream()
                .filter(s -> s.getStatus() == SaleStatus.COMPLETED)
                .map(this::mapToSimpleDto)
                .collect(Collectors.toList());
    }

    private SaleDto mapToSimpleDto(Sale sale) {
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
                sale.getCreatedBy() != null ? sale.getCreatedBy().getFullName() : "Unknown",
                null,
                sale.getCreatedAt(),
                sale.getUpdatedAt()
        );
    }
}
