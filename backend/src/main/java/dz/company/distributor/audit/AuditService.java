package dz.company.distributor.audit;

import dz.company.distributor.audit.dto.AuditLogDto;
import dz.company.distributor.security.SecurityUtils;
import dz.company.distributor.users.User;
import dz.company.distributor.users.UserRepository;
import dz.company.distributor.warehouses.Warehouse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class AuditService {

    private static final Logger log = LoggerFactory.getLogger(AuditService.class);

    private final AuditLogRepository auditLogRepository;
    private final UserRepository userRepository;

    public AuditService(AuditLogRepository auditLogRepository, UserRepository userRepository) {
        this.auditLogRepository = auditLogRepository;
        this.userRepository = userRepository;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void logAction(String action, String entityType, Object entityId, String description) {
        logAction(action, entityType, entityId, null, null, null, description);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void logAction(String action, String entityType, Object entityId, Warehouse warehouse,
                          String oldValues, String newValues, String description) {
        try {
            Long userId = SecurityUtils.getCurrentUserId();
            User user = (userId != null) ? userRepository.findById(userId).orElse(null) : null;
            String entityIdStr = entityId != null ? String.valueOf(entityId) : null;

            AuditLog auditLog = new AuditLog(
                    user,
                    warehouse,
                    action,
                    entityType,
                    entityIdStr,
                    oldValues,
                    newValues,
                    description,
                    null
            );

            auditLogRepository.save(auditLog);
        } catch (Exception e) {
            log.error("Failed to save audit log: {}", e.getMessage(), e);
        }
    }

    @Transactional(readOnly = true)
    public List<AuditLogDto> getAuditLogs(Long warehouseId) {
        if (warehouseId != null) {
            return getLogsByWarehouse(warehouseId);
        }
        return getAllLogs();
    }

    @Transactional(readOnly = true)
    public List<AuditLogDto> getAllLogs() {
        return auditLogRepository.findAllByOrderByCreatedAtDesc()
                .stream()
                .map(this::mapToDto)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<AuditLogDto> getLogsByWarehouse(Long warehouseId) {
        return auditLogRepository.findByWarehouseIdOrderByCreatedAtDesc(warehouseId)
                .stream()
                .map(this::mapToDto)
                .collect(Collectors.toList());
    }

    private AuditLogDto mapToDto(AuditLog log) {
        AuditLogDto dto = new AuditLogDto();
        dto.setId(log.getId());
        if (log.getUser() != null) {
            dto.setUserId(log.getUser().getId());
            dto.setUsername(log.getUser().getUsername());
            dto.setUserFullName(log.getUser().getFullName());
        }
        if (log.getWarehouse() != null) {
            dto.setWarehouseId(log.getWarehouse().getId());
            dto.setWarehouseName(log.getWarehouse().getName());
        }
        dto.setAction(log.getAction());
        dto.setEntityType(log.getEntityType());
        dto.setEntityId(log.getEntityId());
        dto.setOldValues(log.getOldValues());
        dto.setNewValues(log.getNewValues());
        dto.setDescription(log.getDescription());
        dto.setIpAddress(log.getIpAddress());
        dto.setCreatedAt(log.getCreatedAt());
        return dto;
    }
}
