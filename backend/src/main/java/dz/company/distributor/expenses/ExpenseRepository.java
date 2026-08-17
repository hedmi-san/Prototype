package dz.company.distributor.expenses;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface ExpenseRepository extends JpaRepository<Expense, Long> {
    List<Expense> findByWarehouseIdOrderByExpenseDateDesc(Long warehouseId);
    List<Expense> findAllByOrderByExpenseDateDesc();

    @Query("SELECT e FROM Expense e WHERE e.expenseDate BETWEEN :startDate AND :endDate ORDER BY e.expenseDate DESC")
    List<Expense> findExpensesInDateRange(@Param("startDate") LocalDate startDate, @Param("endDate") LocalDate endDate);

    @Query("SELECT e FROM Expense e WHERE e.warehouse.id = :warehouseId AND e.expenseDate BETWEEN :startDate AND :endDate ORDER BY e.expenseDate DESC")
    List<Expense> findWarehouseExpensesInDateRange(@Param("warehouseId") Long warehouseId, @Param("startDate") LocalDate startDate, @Param("endDate") LocalDate endDate);
}
