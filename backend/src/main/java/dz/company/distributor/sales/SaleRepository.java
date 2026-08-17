package dz.company.distributor.sales;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface SaleRepository extends JpaRepository<Sale, Long> {
    Optional<Sale> findByInvoiceNumber(String invoiceNumber);
    List<Sale> findByWarehouseIdOrderBySaleDateDesc(Long warehouseId);
    List<Sale> findAllByOrderBySaleDateDesc();
    
    @Query("SELECT s FROM Sale s WHERE s.saleDate BETWEEN :startDate AND :endDate ORDER BY s.saleDate DESC")
    List<Sale> findSalesInDateRange(@Param("startDate") LocalDateTime startDate, @Param("endDate") LocalDateTime endDate);

    @Query("SELECT s FROM Sale s WHERE s.warehouse.id = :warehouseId AND s.saleDate BETWEEN :startDate AND :endDate ORDER BY s.saleDate DESC")
    List<Sale> findWarehouseSalesInDateRange(@Param("warehouseId") Long warehouseId, @Param("startDate") LocalDateTime startDate, @Param("endDate") LocalDateTime endDate);

    @Query("SELECT COUNT(s) FROM Sale s WHERE s.saleDate >= :startOfMonth")
    long countSalesThisMonth(@Param("startOfMonth") LocalDateTime startOfMonth);
}
