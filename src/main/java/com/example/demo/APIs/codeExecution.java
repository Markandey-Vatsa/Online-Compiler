package com.example.demo.APIs;


import com.example.demo.POJOs.CodeObject;
import com.example.demo.POJOs.ExecutionResult;
import com.example.demo.Services.CodeExecute;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/")
public class codeExecution {

    codeExecution(CodeExecute execute){
        this.execute = execute;
    }

    CodeExecute execute;

    @PostMapping("/execute")
    ExecutionResult codeExecute(@RequestBody CodeObject codeObject){
        String input = codeObject.getInputs();
        ExecutionResult res = execute.execute(codeObject.getCode(),input);
        return res;
    }


}
