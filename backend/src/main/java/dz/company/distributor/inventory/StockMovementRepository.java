package dz.company.distributor.inventory;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface StockMovementRepository extends JpaRepository<StockMovement, Long> {
    List<StockMovement> findByWarehouseIdOrderByCreatedAtDesc(Long warehouseId);
    List<StockMovement> findAllByOrderByCreatedAtDesc();
    List<StockMovement> findByProductIdOrderByCreatedAtDesc(Long productId);
    List<StockMovement> findByReferenceTypeAndReferenceId(String referenceType, Long referenceId);
}
