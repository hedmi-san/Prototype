package dz.company.distributor.salaries;

import dz.company.distributor.common.response.ApiResponse;
import dz.company.distributor.salaries.dto.CreateSalaryRequest;
import dz.company.distributor.salaries.dto.SalaryRecordDto;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/salaries")
public class SalaryController {

    private final SalaryService salaryService;

    public SalaryController(SalaryService salaryService) {
        this.salaryService = salaryService;
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<SalaryRecordDto>>> getSalaries(
            @RequestParam(required = false) Long warehouseId) {
        List<SalaryRecordDto> list = salaryService.getSalaries(warehouseId);
        return ResponseEntity.ok(ApiResponse.success(list));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<ApiResponse<SalaryRecordDto>> recordSalary(@Valid @RequestBody CreateSalaryRequest request) {
        SalaryRecordDto created = salaryService.recordSalary(request);
        return ResponseEntity.ok(ApiResponse.success("Salary recorded successfully", created));
    }
}
