package dz.company.distributor.reports;

import dz.company.distributor.common.response.ApiResponse;
import dz.company.distributor.reports.dto.DashboardMetricsDto;
import dz.company.distributor.reports.dto.FinancialReportDto;
import dz.company.distributor.reports.dto.StockValuationReportDto;
import dz.company.distributor.sales.dto.SaleDto;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/reports")
public class ReportController {

    private final DashboardService dashboardService;
    private final StockReportService stockReportService;
    private final SalesReportService salesReportService;
    private final FinancialReportService financialReportService;

    public ReportController(
            DashboardService dashboardService,
            StockReportService stockReportService,
            SalesReportService salesReportService,
            FinancialReportService financialReportService) {
        this.dashboardService = dashboardService;
        this.stockReportService = stockReportService;
        this.salesReportService = salesReportService;
        this.financialReportService = financialReportService;
    }

    @GetMapping("/dashboard")
    public ResponseEntity<ApiResponse<DashboardMetricsDto>> getDashboardMetrics(
            @RequestParam(required = false) Long warehouseId) {
        DashboardMetricsDto metrics = dashboardService.getDashboardMetrics(warehouseId);
        return ResponseEntity.ok(ApiResponse.success(metrics));
    }

    @GetMapping("/stock-valuation")
    public ResponseEntity<ApiResponse<StockValuationReportDto>> getStockValuationReport(
            @RequestParam(required = false) Long warehouseId) {
        StockValuationReportDto report = stockReportService.getStockValuationReport(warehouseId);
        return ResponseEntity.ok(ApiResponse.success(report));
    }

    @GetMapping("/sales")
    public ResponseEntity<ApiResponse<List<SaleDto>>> getSalesReport(
            @RequestParam(required = false) Long warehouseId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime endDate) {
        List<SaleDto> sales = salesReportService.getSalesReport(warehouseId, startDate, endDate);
        return ResponseEntity.ok(ApiResponse.success(sales));
    }

    @GetMapping("/financial")
    public ResponseEntity<ApiResponse<FinancialReportDto>> getFinancialReport(
            @RequestParam(required = false) Long warehouseId,
            @RequestParam(required = false) String period) {
        FinancialReportDto report = financialReportService.getFinancialReport(warehouseId, period);
        return ResponseEntity.ok(ApiResponse.success(report));
    }
}
