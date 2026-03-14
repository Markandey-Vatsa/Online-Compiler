package com.example.demo.Services;
import com.example.demo.POJOs.ExecutionResult;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.concurrent.TimeUnit;


//1. Create execution directory
//2. Write Main.java
//3. Compile → javac Main.java
//4. Run → java Main
//5. Capture program output
//6. Store result
//7. Return ExecutionResult


@Service
public class CodeExecute {

    public ExecutionResult execute(String code,String input){

        ExecutionResult result = new ExecutionResult();



        long startTime = 0;
        long endTime = 0;

        Path dirPath = null;

        try{

            Path baseDir = Paths.get("Executions");
            Files.createDirectories(baseDir);

            Path execDir = Files.createTempDirectory(baseDir, "run_");
            dirPath = execDir;

            Path sourceFile = execDir.resolve("Main.java");
            Files.write(sourceFile, code.getBytes(StandardCharsets.UTF_8));

            ProcessBuilder pb = new ProcessBuilder("javac","Main.java");
            pb.directory(execDir.toFile());

            Process compileProcess = pb.start();

            int compileExit = compileProcess.waitFor();

            if (compileExit != 0) {

                try(
                BufferedReader errorReader =
                        new BufferedReader(new InputStreamReader(compileProcess.getErrorStream()));
                ) {
                    StringBuilder errorOutput = new StringBuilder();
                    String line;

                    while ((line = errorReader.readLine()) != null) {
                        errorOutput.append(line).append("\n");
                    }

                    result.setStatus("compile_error");
                    result.setError(errorOutput.toString());
                }

                return result;
            }

            startTime = System.currentTimeMillis();

            ProcessBuilder run = new ProcessBuilder("java","Main");
            run.directory(execDir.toFile());

            Process runProcess = run.start();


//            Get user input if any
            if (input != null && !input.isEmpty()) {
                try (var writer = runProcess.getOutputStream()) {
                    writer.write(input.getBytes(StandardCharsets.UTF_8));
                    writer.flush();
                }
            }



            boolean finished = runProcess.waitFor(3, TimeUnit.SECONDS);

            if(!finished){
                runProcess.destroyForcibly();
                endTime = System.currentTimeMillis();
                result.setExecutionTime(endTime-startTime);
                result.setStatus("timeout");
                result.setError("Execution time exceeded 3 seconds.");

                return result;
            }


try(
    BufferedReader reader =
            new BufferedReader(new InputStreamReader(runProcess.getInputStream()));



        BufferedReader errorReader =
                new BufferedReader(new InputStreamReader(runProcess.getErrorStream()));
) {

        StringBuilder output = new StringBuilder();
        StringBuilder errorOutput = new StringBuilder();
        String line;

// read normal output
        while ((line = reader.readLine()) != null) {
            output.append(line).append("\n");
        }

// read runtime errors
        while ((line = errorReader.readLine()) != null) {
            errorOutput.append(line).append("\n");
        }


        if (!errorOutput.isEmpty()) {
            result.setStatus("runtime_error");
            result.setError(errorOutput.toString());
        } else {
            result.setStatus("success");
            result.setOutput(output.toString());
        }
    }


            endTime = System.currentTimeMillis();

            long executionTime = endTime-startTime;
            result.setExecutionTime(executionTime);



        }catch(Exception e){

            result.setStatus("error");
            result.setError(e.getMessage());
        }finally {
            if(dirPath != null){
                try {
                    deleteDirectory(dirPath);
                }catch(Exception ignored){

                }
            }
        }



        return result;
    }



    private void deleteDirectory(Path dir) throws Exception {
        Files.walk(dir)
                .sorted((a, b) -> b.compareTo(a)) // delete children first
                .forEach(path -> {
                    try {
                        Files.delete(path);
                    } catch (Exception ignored) {}
                });
    }



}

//
//Receive code + input
//        ↓
//Create temporary execution directory
//        ↓
//Write Main.java
//        ↓
//Compile code
//        ↓
//If compile fails → return compile_error
//        ↓
//Start timer
//        ↓
//Run program
//        ↓
//Send input to program
//        ↓
//Wait for completion (timeout protected)
//        ↓
//Read stdout + stderr
//        ↓
//Determine success or runtime_error
//        ↓
//Stop timer
//        ↓
//Delete execution directory
//        ↓
//Return ExecutionResult