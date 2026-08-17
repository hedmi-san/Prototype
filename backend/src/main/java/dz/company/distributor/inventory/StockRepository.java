package dz.company.distributor.inventory;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface StockRepository extends JpaRepository<Stock, Long> {

    Optional<Stock> findByWarehouseIdAndProductId(Long warehouseId, Long productId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT s FROM Stock s WHERE s.warehouse.id = :warehouseId AND s.product.id = :productId")
    Optional<Stock> findWithLockByWarehouseIdAndProductId(@Param("warehouseId") Long warehouseId, @Param("productId") Long productId);

    List<Stock> findByWarehouseId(Long warehouseId);

    List<Stock> findByProductId(Long productId);

    @Query("SELECT s FROM Stock s WHERE s.warehouse.id = :warehouseId AND (s.physicalQuantity - s.reservedQuantity) <= :threshold")
    List<Stock> findLowStockByWarehouseId(@Param("warehouseId") Long warehouseId, @Param("threshold") int threshold);

    @Query("SELECT s FROM Stock s WHERE (s.physicalQuantity - s.reservedQuantity) <= :threshold")
    List<Stock> findAllLowStock(@Param("threshold") int threshold);
}
