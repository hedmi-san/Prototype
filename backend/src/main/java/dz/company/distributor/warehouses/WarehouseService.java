package dz.company.distributor.warehouses;

import dz.company.distributor.audit.AuditService;
import dz.company.distributor.common.exception.BusinessException;
import dz.company.distributor.common.exception.ResourceNotFoundException;
import dz.company.distributor.warehouses.dto.WarehouseDto;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class WarehouseService {

    private final WarehouseRepository warehouseRepository;
    private final AuditService auditService;

    public WarehouseService(WarehouseRepository warehouseRepository, AuditService auditService) {
        this.warehouseRepository = warehouseRepository;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public List<WarehouseDto> getAllWarehouses() {
        return warehouseRepository.findAll().stream()
                .map(this::mapToDto)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<WarehouseDto> getActiveWarehouses() {
        return warehouseRepository.findByActiveTrue().stream()
                .map(this::mapToDto)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public WarehouseDto getWarehouseById(Long id) {
        Warehouse warehouse = warehouseRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Warehouse not found with id: " + id));
        return mapToDto(warehouse);
    }

    @Transactional
    public WarehouseDto createWarehouse(WarehouseDto dto) {
        if (warehouseRepository.existsByCode(dto.getCode())) {
            throw new BusinessException("Warehouse code already exists: " + dto.getCode());
        }
        if (warehouseRepository.existsByName(dto.getName())) {
            throw new BusinessException("Warehouse name already exists: " + dto.getName());
        }

        Warehouse warehouse = new Warehouse(
                dto.getName(),
                dto.getCode(),
                dto.getAddress(),
                dto.getPhone(),
                true
        );
        Warehouse saved = warehouseRepository.save(warehouse);

        auditService.logAction(
                "WAREHOUSE_CREATED",
                "WAREHOUSE",
                saved.getId(),
                saved,
                null,
                saved.getName() + " (" + saved.getCode() + ")",
                "Created new warehouse " + saved.getName()
        );

        return mapToDto(saved);
    }

    @Transactional
    public WarehouseDto updateWarehouse(Long id, WarehouseDto dto) {
        Warehouse warehouse = warehouseRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Warehouse not found with id: " + id));

        warehouse.setName(dto.getName());
        warehouse.setAddress(dto.getAddress());
        warehouse.setPhone(dto.getPhone());
        warehouse.setActive(dto.isActive());

        Warehouse updated = warehouseRepository.save(warehouse);

        auditService.logAction(
                "WAREHOUSE_UPDATED",
                "WAREHOUSE",
                updated.getId(),
                updated,
                null,
                updated.getName(),
                "Updated warehouse details for " + updated.getName()
        );

        return mapToDto(updated);
    }

    public WarehouseDto mapToDto(Warehouse warehouse) {
        return new WarehouseDto(
                warehouse.getId(),
                warehouse.getName(),
                warehouse.getCode(),
                warehouse.getAddress(),
                warehouse.getPhone(),
                warehouse.isActive(),
                warehouse.getCreatedAt(),
                warehouse.getUpdatedAt()
        );
    }
}
