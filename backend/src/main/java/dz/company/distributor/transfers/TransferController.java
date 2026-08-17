package dz.company.distributor.transfers;

import dz.company.distributor.common.response.ApiResponse;
import dz.company.distributor.transfers.dto.ApproveTransferRequest;
import dz.company.distributor.transfers.dto.CreateTransferRequest;
import dz.company.distributor.transfers.dto.TransferDto;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/transfers")
public class TransferController {

    private final TransferService transferService;

    public TransferController(TransferService transferService) {
        this.transferService = transferService;
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<TransferDto>>> getTransfers(
            @RequestParam(required = false) Long warehouseId) {
        List<TransferDto> list = transferService.getTransfers(warehouseId);
        return ResponseEntity.ok(ApiResponse.success(list));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<TransferDto>> getTransferById(@PathVariable Long id) {
        TransferDto transfer = transferService.getTransferById(id);
        return ResponseEntity.ok(ApiResponse.success(transfer));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'SUPER_MANAGER')")
    public ResponseEntity<ApiResponse<TransferDto>> createTransfer(@Valid @RequestBody CreateTransferRequest request) {
        TransferDto created = transferService.createTransfer(request);
        return ResponseEntity.ok(ApiResponse.success("Transfer request created successfully", created));
    }

    @PostMapping("/{id}/approve")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'SUPER_MANAGER')")
    public ResponseEntity<ApiResponse<TransferDto>> approveTransfer(@PathVariable Long id,
            @Valid @RequestBody ApproveTransferRequest request) {
        TransferDto approved = transferService.approveTransfer(id, request);
        return ResponseEntity.ok(ApiResponse.success("Transfer approved and stock reserved successfully", approved));
    }

    @PostMapping("/{id}/confirm")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'SUPER_MANAGER')")
    public ResponseEntity<ApiResponse<TransferDto>> confirmTransfer(@PathVariable Long id) {
        TransferDto confirmed = transferService.confirmTransfer(id);
        return ResponseEntity.ok(ApiResponse.success("Transfer reception confirmed and stock updated", confirmed));
    }

    @PostMapping("/{id}/decline")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'SUPER_MANAGER')")
    public ResponseEntity<ApiResponse<TransferDto>> declineTransfer(@PathVariable Long id) {
        TransferDto declined = transferService.declineTransfer(id);
        return ResponseEntity.ok(ApiResponse.success("Transfer declined successfully", declined));
    }

    @PostMapping("/{id}/cancel")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'SUPER_MANAGER')")
    public ResponseEntity<ApiResponse<TransferDto>> cancelTransfer(@PathVariable Long id) {
        TransferDto cancelled = transferService.cancelTransfer(id);
        return ResponseEntity.ok(ApiResponse.success("Transfer cancelled successfully", cancelled));
    }
}
