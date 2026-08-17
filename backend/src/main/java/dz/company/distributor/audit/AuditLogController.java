package dz.company.distributor.audit;

import dz.company.distributor.audit.dto.AuditLogDto;
import dz.company.distributor.common.response.ApiResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/audit-logs")
public class AuditLogController {

    private final AuditService auditService;

    public AuditLogController(AuditService auditService) {
        this.auditService = auditService;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'SUPER_MANAGER')")
    public ResponseEntity<ApiResponse<List<AuditLogDto>>> getAuditLogs(
            @RequestParam(required = false) Long warehouseId) {
        List<AuditLogDto> logs = auditService.getAuditLogs(warehouseId);
        return ResponseEntity.ok(ApiResponse.success(logs));
    }
}
