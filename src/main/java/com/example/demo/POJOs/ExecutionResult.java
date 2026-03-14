package com.example.demo.POJOs;


import lombok.Getter;
import lombok.Setter;
import org.springframework.stereotype.Component;

@Getter
@Setter
public class ExecutionResult {
    private String status;
    private String error;
    private long executionTime;
    private String output;
}
