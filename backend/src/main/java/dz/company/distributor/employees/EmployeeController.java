package dz.company.distributor.employees;

import dz.company.distributor.common.response.ApiResponse;
import dz.company.distributor.employees.dto.CreateEmployeeRequest;
import dz.company.distributor.employees.dto.EmployeeDto;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/employees")
public class EmployeeController {

    private final EmployeeService employeeService;

    public EmployeeController(EmployeeService employeeService) {
        this.employeeService = employeeService;
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<EmployeeDto>>> getEmployees(
            @RequestParam(required = false) Long warehouseId) {
        List<EmployeeDto> list = employeeService.getEmployees(warehouseId);
        return ResponseEntity.ok(ApiResponse.success(list));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<EmployeeDto>> getEmployeeById(@PathVariable Long id) {
        EmployeeDto employee = employeeService.getEmployeeById(id);
        return ResponseEntity.ok(ApiResponse.success(employee));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<ApiResponse<EmployeeDto>> createEmployee(@Valid @RequestBody CreateEmployeeRequest request) {
        EmployeeDto created = employeeService.createEmployee(request);
        return ResponseEntity.ok(ApiResponse.success("Employee registered successfully", created));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<ApiResponse<EmployeeDto>> updateEmployee(@PathVariable Long id,
            @Valid @RequestBody CreateEmployeeRequest request) {
        EmployeeDto updated = employeeService.updateEmployee(id, request);
        return ResponseEntity.ok(ApiResponse.success("Employee updated successfully", updated));
    }
}
